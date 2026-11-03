import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  recordDeltaDispositionSchema,
  type DeltaDocumentInput,
  type DeltaEvidence,
  type DeltaInput,
  type DeltaNoteInput,
  type DeltaObservationInput,
} from '@glucoflow/contracts';
import { buildDelta } from '@glucoflow/domain';
import {
  getPatientSummary,
  listDocuments,
  listLatestDeltaDispositions,
  listNotes,
  loadTimelinePage,
  recordDeltaDisposition,
} from '@glucoflow/data';
import { assertPatientAccess, requireCapability } from '../auth';
import { ApiError } from '../errors';
import { parseBody, requireActor, withActorTx } from './helpers';
import type { AppContext } from '../context';

const patientParams = z.object({ id: z.string().uuid() });

function sourceName(documentId: string, names: Map<string, string>): string {
  return names.get(documentId) ?? 'Source document';
}

function todayInIndia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function mapEvidence(
  evidence: {
    documentVersionId: string;
    page: number;
    quote: string;
    bbox: [number, number, number, number] | null;
  }[],
  documentId: string,
  names: Map<string, string>,
): DeltaEvidence[] {
  return evidence.map((item) => ({
    documentId,
    documentVersionId: item.documentVersionId,
    documentName: sourceName(documentId, names),
    page: item.page,
    quote: item.quote,
    bbox: item.bbox,
  }));
}

export function registerDeltaRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get<{ Params: { id: string } }>('/api/v1/patients/:id/delta', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    const params = patientParams.safeParse(request.params);
    if (!params.success) throw ApiError.validation('The patient id is not valid.');

    return withActorTx(ctx, request, async (client) => {
      const patient = await getPatientSummary(client, params.data.id);
      if (!patient) throw ApiError.notFound('That patient record is not available.');
      assertPatientAccess(actor, patient.patientId, patient.clinicId);

      const page = await loadTimelinePage(
        client,
        patient.patientId,
        { testCodes: [] },
        100,
        0,
        { events: 0, notes: 0 },
      );
      const documents = await listDocuments(client, patient.patientId, { limit: 100 });
      const notes = await listNotes(client, patient.patientId);
      const dispositions = await listLatestDeltaDispositions(client, patient.patientId);
      const names = new Map(documents.items.map((document) => [document.documentId, document.filename]));

      const observations: DeltaObservationInput[] = page.observations.map((observation) => ({
        factId: observation.factId,
        testCode: observation.testCode,
        displayName: observation.displayName,
        numericValue: observation.numericValue,
        unit: observation.unit,
        date: observation.date,
        datePrecision: observation.datePrecision,
        status: observation.status,
        evidence: mapEvidence(observation.evidence, observation.documentId, names),
      }));

      const events: DeltaInput['events'] = page.events.map((event) => ({
        factId: event.factId,
        kind: event.kind,
        label: event.label,
        detail: event.detail,
        date: event.date,
        status: event.status,
        evidence: mapEvidence(event.evidence, event.documentId, names),
      }));

      const noteInputs: DeltaNoteInput[] = notes.map((note) => ({
        noteId: note.noteId,
        category: note.category,
        body: note.body,
        eventDate: note.eventDate,
        submittedAt: note.submittedAt,
      }));

      const documentInputs: DeltaDocumentInput[] = documents.items.map((document) => ({
        documentId: document.documentId,
        filename: document.filename,
        kind: document.kind,
        state: document.state,
        pageCount: document.pageCount,
        uploadedAt: document.uploadedAt,
        issues: document.issues,
        coverageNote: document.coverageNote,
      }));

      // The reference is the previous distinct record date, not the latest one.
      // The latest results are the change the doctor is about to read.
      const distinctDates = [
        ...new Set(
          [...observations.map((item) => item.date), ...events.map((item) => item.date)].filter(
            (value): value is string => Boolean(value),
          ),
        ),
      ].sort();
      const referenceDate = distinctDates.length > 1 ? distinctDates.at(-2)! : null;

      const input: DeltaInput = {
        patient: {
          patientId: patient.patientId,
          displayName: patient.displayName,
          clinicIdentifier: patient.clinicIdentifier,
          birthDate: patient.birthDate,
        },
        asOf: todayInIndia(),
        lastVisitDate: referenceDate,
        observations,
        events,
        notes: noteInputs,
        documents: documentInputs,
        openItems: [],
        unknownItems: [],
        dispositions,
        truncated: page.observationTotal > observations.length,
      };

      return buildDelta(input);
    });
  });

  app.post<{ Params: { id: string } }>(
    '/api/v1/patients/:id/delta/dispositions',
    async (request, reply) => {
      const actor = requireActor(request);
      requireCapability(actor, 'clinic');
      const params = patientParams.safeParse(request.params);
      if (!params.success) throw ApiError.validation('The patient id is not valid.');
      const body = parseBody(recordDeltaDispositionSchema, request.body);

      const result = await withActorTx(ctx, request, async (client) => {
        const patient = await getPatientSummary(client, params.data.id);
        if (!patient) throw ApiError.notFound('That patient record is not available.');
        assertPatientAccess(actor, patient.patientId, patient.clinicId);
        return recordDeltaDisposition(client, patient.patientId, body);
      });

      reply.code(201);
      return result;
    },
  );
}
