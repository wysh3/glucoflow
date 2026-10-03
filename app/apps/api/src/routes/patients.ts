import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createExportSchema,
  createNoteSchema,
  correctNoteSchema,
  recordSearchQuerySchema,
  TIMELINE_DISPLAY_BOUND,
  type TimelineResult,
} from '@glucoflow/contracts';
import {
  buildTimeline,
  describeCoverageScope,
} from '@glucoflow/domain';
import {
  acknowledgeNote,
  correctNote,
  createExport,
  getExport,
  getPatientSummary,
  listDocuments,
  listHistory,
  listNotes,
  listPatients,
  listExports,
  loadTimelinePage,
  availableTestCodes,
  searchPatientRecords,
  submitNote,
  documentVersions,
  getDocumentRow,
} from '@glucoflow/data';
import { assertPatientAccess, requireCapability } from '../auth';
import { ApiError } from '../errors';
import {
  idempotencyKey,
  parseBody,
  parseQuery,
  requireActor,
  withActorTx,
} from './helpers';
import { withIdempotency } from './idempotency';
import type { AppContext } from '../context';

const patientListQuery = z.object({
  search: z.string().max(120).optional(),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const timelineQueryParams = z.object({
  eventsCursor: z.string().max(512).optional(),
  notesCursor: z.string().max(512).optional(),
  testCode: z.union([z.string(), z.array(z.string())]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const pageQuery = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export function registerPatientRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/api/v1/me', async (request) => {
    const actor = requireActor(request);
    return {
      actor: {
        userId: actor.profile.userId,
        email: actor.profile.email,
        displayName: actor.profile.displayName,
        demoMode: ctx.config.APP_ENV !== 'production',
      },
      contexts: actor.contexts,
      capabilities: actor.capabilities,
      appEnv: ctx.config.APP_ENV,
      extraction: {
        mode: ctx.config.EXTRACTION_PROVIDER === 'fixture' ? 'fixture' : 'live',
        provider: ctx.config.EXTRACTION_PROVIDER,
        model: ctx.config.EXTRACTION_MODEL,
        label:
          ctx.config.EXTRACTION_PROVIDER === 'fixture'
            ? 'Fixture data: deterministic rule engine, not an AI model'
            : `Live extraction model: ${ctx.config.EXTRACTION_MODEL}`,
      },
      storage: { mode: ctx.config.STORAGE_MODE },
      serverTime: new Date().toISOString(),
    };
  });

  app.get('/api/v1/patients', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    const query = parseQuery(patientListQuery, request.query);
    return withActorTx(ctx, request, (client) =>
      listPatients(client, {
        search: query.search,
        cursor: query.cursor,
        limit: query.limit,
      }),
    );
  });

  app.get<{ Params: { id: string } }>('/api/v1/patients/:id', async (request) => {
    const actor = requireActor(request);
    const patient = await withActorTx(ctx, request, (client) =>
      getPatientSummary(client, request.params.id),
    );
    if (!patient) throw ApiError.notFound('That patient record is not available.');
    assertPatientAccess(actor, patient.patientId, patient.clinicId);
    return patient;
  });

  app.get<{ Params: { id: string } }>('/api/v1/patients/:id/timeline', async (request) => {
    const actor = requireActor(request);
    const query = parseQuery(timelineQueryParams, request.query);
    const rawCodes = query.testCode;
    const testCodes = (
      Array.isArray(rawCodes) ? rawCodes : rawCodes ? [rawCodes] : []
    ).slice(0, 3);
    const limit = query.limit ?? 100;

    return withActorTx(ctx, request, async (client) => {
      const patient = await getPatientSummary(client, request.params.id);
      if (!patient) throw ApiError.notFound('That patient record is not available.');
      assertPatientAccess(actor, patient.patientId, patient.clinicId);

      const decodeOffset = (cursor?: string): number => {
        const value = cursor ? Number(Buffer.from(cursor, 'base64url').toString('utf8')) : 0;
        if (!Number.isInteger(value) || value < 0 || value > TIMELINE_DISPLAY_BOUND) throw ApiError.validation('Invalid timeline cursor.');
        return value;
      };
      const offset = decodeOffset(query.cursor);
      const eventsOffset = decodeOffset(query.eventsCursor);
      const notesOffset = decodeOffset(query.notesCursor);
      const page = await loadTimelinePage(
        client,
        request.params.id,
        { testCodes, from: query.from, to: query.to },
        limit,
        Number.isFinite(offset) && offset >= 0 ? offset : 0,
        { events: eventsOffset, notes: notesOffset },
      );
      const tests = await availableTestCodes(client, request.params.id);

      const timeline = buildTimeline(
        { observations: page.observations, events: page.events, notes: page.notes },
        { testCodes, from: query.from, to: query.to },
        {
          observationCount: page.observationTotal,
          eventCount: page.eventTotal,
          noteCount: page.noteTotal,
          latestReportDate: page.latestReportDate,
          awaitingReviewCount: page.awaitingReviewCount,
          sourceOnlyCount: page.sourceOnlyCount,
        },
      ) satisfies TimelineResult;

      const loaded = (Number.isFinite(offset) ? offset : 0) + page.observations.length;
      const nextCursor =
        loaded < page.observationTotal && loaded < TIMELINE_DISPLAY_BOUND
          ? Buffer.from(String(loaded), 'utf8').toString('base64url')
          : null;

      return {
        ...timeline,
        snapshotRevision: patient.approvalRevision,
        nextCursor,
        eventsNextCursor: eventsOffset + page.events.length < page.eventTotal && eventsOffset + page.events.length < TIMELINE_DISPLAY_BOUND ? Buffer.from(String(eventsOffset + page.events.length)).toString('base64url') : null,
        notesNextCursor: notesOffset + page.notes.length < page.noteTotal && notesOffset + page.notes.length < TIMELINE_DISPLAY_BOUND ? Buffer.from(String(notesOffset + page.notes.length)).toString('base64url') : null,
        contextTruncated: page.eventTotal > TIMELINE_DISPLAY_BOUND || page.noteTotal > TIMELINE_DISPLAY_BOUND,
        availableTestCodes: tests,
        scopeNote: describeCoverageScope(timeline),
        patient: {
          patientId: patient.patientId,
          displayName: patient.displayName,
          clinicIdentifier: patient.clinicIdentifier,
          clinicId: patient.clinicId,
        },
      };
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/patients/:id/documents', async (request) => {
    const actor = requireActor(request);
    const query = parseQuery(pageQuery, request.query);
    return withActorTx(ctx, request, async (client) => {
      const patient = await getPatientSummary(client, request.params.id);
      if (!patient) throw ApiError.notFound('That patient record is not available.');
      assertPatientAccess(actor, patient.patientId, patient.clinicId);
      const page = await listDocuments(client, request.params.id, {
        cursor: query.cursor,
        limit: query.limit,
      });
      const items = await Promise.all(
        page.items.map(async (document) => ({
          ...document,
          versions: await documentVersions(client, document.documentId),
        })),
      );
      return { ...page, items };
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/patients/:id/history', async (request) => {
    const actor = requireActor(request);
    const query = parseQuery(pageQuery, request.query);
    requireCapability(actor, 'clinic');
    return withActorTx(ctx, request, async (client) => {
      const patient = await getPatientSummary(client, request.params.id);
      if (!patient) throw ApiError.notFound('That patient record is not available.');
      assertPatientAccess(actor, patient.patientId, patient.clinicId);
      return listHistory(client, request.params.id, {
        cursor: query.cursor,
        limit: query.limit,
      });
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/patients/:id/search', async (request) => {
    const actor = requireActor(request);
    const query = parseQuery(recordSearchQuerySchema, request.query);
    return withActorTx(ctx, request, async (client) => {
      const patient = await getPatientSummary(client, request.params.id);
      if (!patient) throw ApiError.notFound('That patient record is not available.');
      assertPatientAccess(actor, patient.patientId, patient.clinicId);
      return searchPatientRecords(client, request.params.id, {
        q: query.q,
        from: query.from,
        to: query.to,
        category: query.category,
        cursor: query.cursor,
      });
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/patients/:id/notes', async (request) => {
    const actor = requireActor(request);
    const query = parseQuery(
      z.object({ history: z.enum(['true', 'false']).optional() }),
      request.query,
    );
    return withActorTx(ctx, request, async (client) => {
      const patient = await getPatientSummary(client, request.params.id);
      if (!patient) throw ApiError.notFound('That patient record is not available.');
      assertPatientAccess(actor, patient.patientId, patient.clinicId);
      const includeHistory = query.history === 'true' && actor.capabilities.clinicIds.length > 0;
      const notes = await listNotes(client, request.params.id, { includeHistory });
      return { items: notes };
    });
  });

  app.post<{ Params: { id: string } }>('/api/v1/patients/:id/notes', async (request, reply) => {
    const body = parseBody(createNoteSchema, request.body);
    const actor = requireActor(request);
    // Notes are patient-authored: only the linked patient account may write one.
    if (!actor.capabilities.patientIds.includes(request.params.id)) {
      throw ApiError.forbidden('Only the linked patient can submit a note for this record.');
    }
    const note = await withActorTx(ctx, request, (client) =>
      submitNote(client, request.params.id, body),
    );
    reply.code(201);
    return note;
  });

  app.post<{ Params: { id: string } }>('/api/v1/notes/:id/corrections', async (request, reply) => {
    const body = parseBody(correctNoteSchema, request.body);
    const note = await withActorTx(ctx, request, (client) =>
      correctNote(client, request.params.id, body),
    );
    reply.code(201);
    return note;
  });

  app.post<{ Params: { id: string } }>('/api/v1/notes/:id/acknowledge', async (request) => {
    const actor = requireActor(request);
    if (!actor.capabilities.canAcknowledgeNote) {
      throw ApiError.forbidden('Clinic membership is required to acknowledge a note.');
    }
    return withActorTx(ctx, request, (client) => acknowledgeNote(client, request.params.id));
  });

  app.post<{ Params: { id: string } }>('/api/v1/patients/:id/exports', async (request, reply) => {
    const body = parseBody(createExportSchema, request.body);
    const key = idempotencyKey(request, true) ?? '';
    const actor = requireActor(request);
    const patient = await withActorTx(ctx, request, (client) =>
      getPatientSummary(client, request.params.id),
    );
    if (!patient) throw ApiError.notFound('That patient record is not available.');
    assertPatientAccess(actor, patient.patientId, patient.clinicId);

    const result = (await withIdempotency({
      ctx,
      actor,
      route: `POST /patients/${request.params.id}/exports`,
      key,
      body: { ...body, patientId: request.params.id },
      clinicId: patient.clinicId,
      run: (client) => createExport(client, request.params.id, body.approvalRevision),
    })) as { exportId: string; jobId: string; state: string };
    reply.code(202);
    return result;
  });

  app.get<{ Params: { id: string } }>('/api/v1/exports/:id', async (request) => {
    requireActor(request);
    const result = await withActorTx(ctx, request, (client) =>
      getExport(client, request.params.id),
    );
    if (!result) throw ApiError.notFound('That export is not available.');
    if (result.dto.state !== 'ready' || !result.objectPath) return result.dto;
    const url = await ctx.storage.createDownloadUrl(
      ctx.config.STORAGE_BUCKET_EXPORTS,
      result.objectPath,
      60,
    );
    return {
      ...result.dto,
      downloadUrl: url,
      downloadExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
  });

  app.get<{ Params: { id: string } }>('/api/v1/patients/:id/exports', async (request) => {
    requireActor(request);
    const items = await withActorTx(ctx, request, (client) =>
      listExports(client, request.params.id),
    );
    return { items };
  });

  app.get<{ Params: { id: string } }>('/api/v1/documents/:id', async (request) => {
    requireActor(request);
    return withActorTx(ctx, request, async (client) => {
      const document = await getDocumentRow(client, request.params.id);
      if (!document) throw ApiError.notFound('That document is not available.');
      return { ...document, versions: await documentVersions(client, request.params.id) };
    });
  });

}
