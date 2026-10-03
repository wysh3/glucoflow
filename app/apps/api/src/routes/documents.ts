import type { FastifyInstance } from 'fastify';
import {
  amendmentLinkSchema,
  approveSchema,
  queueQuerySchema,
  rejectAssignmentSchema,
  retryRequestSchema,
  reviewPatchSchema,
  reviewRevisionSchema,
} from '@sutra/contracts';
import {
  createReviewRevision,
  documentVersions,
  getDocumentRow,
  getDocumentSource,
  getJobDto,
  getReviewDto,
  linkAmendment,
  listQueue,
  publishReview,
  rejectAssignment,
  requestDocumentRetry,
  reviewActionSummary,
  updateReview,
} from '@sutra/data';
import { requireCapability } from '../auth';
import { ApiError } from '../errors';
import { idempotencyKey, parseBody, parseQuery, requireActor, withActorTx } from './helpers';
import { withIdempotency } from './idempotency';
import type { AppContext } from '../context';
import { DOWNLOAD_URL_SECONDS } from '@sutra/contracts';

export function registerDocumentRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/api/v1/queue', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'review');
    const query = parseQuery(queueQuerySchema, request.query);
    const clinicId = actor.capabilities.clinicIds[0];
    if (!clinicId) throw ApiError.forbidden('This account has no clinic membership.');
    return withActorTx(ctx, request, (client) =>
      listQueue(client, clinicId, {
        state: query.state,
        cursor: query.cursor,
      }),
    );
  });

  app.get<{ Params: { id: string } }>('/api/v1/documents/:id/review', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'review');
    return withActorTx(ctx, request, async (client) => {
      const review = await getReviewDto(client, request.params.id);
      if (!review) throw ApiError.notFound('That review is not available.');
      return { ...review, summary: reviewActionSummary(review) };
    });
  });

  app.patch<{ Params: { id: string } }>('/api/v1/documents/:id/review', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'review');
    const patch = parseBody(reviewPatchSchema, request.body);
    return withActorTx(ctx, request, async (client) => {
      const result = await updateReview(client, request.params.id, patch);
      const review = await getReviewDto(client, request.params.id);
      return { ...result, review };
    });
  });

  app.post<{ Params: { id: string } }>('/api/v1/documents/:id/approve', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'review');
    const body = parseBody(approveSchema, request.body);
    const key = idempotencyKey(request, true) ?? '';
    const document = await withActorTx(ctx, request, (client) =>
      getDocumentRow(client, request.params.id),
    );
    if (!document) throw ApiError.notFound('That document is not available.');

    // A repeated approval with the same Idempotency-Key returns the original batch
    // instead of publishing twice.
    const result = await withIdempotency({
      ctx,
      actor,
      route: `POST /documents/${request.params.id}/approve`,
      key,
      body: { ...body, documentId: request.params.id },
      clinicId: document.clinicId,
      run: async (client) => {
        const approval = await publishReview(
          client,
          request.params.id,
          body.expectedRevision,
          body.dispositions,
        );
        return approval;
      },
    });
    return result;
  });

  app.post<{ Params: { id: string } }>(
    '/api/v1/documents/:id/reject-assignment',
    async (request) => {
      const actor = requireActor(request);
      requireCapability(actor, 'review');
      const body = parseBody(rejectAssignmentSchema, request.body);
      return withActorTx(ctx, request, (client) =>
        rejectAssignment(client, request.params.id, body.expectedRevision, body.reason),
      );
    },
  );

  app.post<{ Params: { id: string } }>('/api/v1/documents/:id/retry', async (request, reply) => {
    const actor = requireActor(request);
    if (!actor.capabilities.canReview) {
      // The owning uploader may also retry an extraction failure.
      const document = await withActorTx(ctx, request, (client) =>
        getDocumentRow(client, request.params.id),
      );
      if (!document) throw ApiError.notFound('That document is not available.');
    }
    const body = parseBody(retryRequestSchema, request.body);
    const result = await withActorTx(ctx, request, (client) =>
      requestDocumentRetry(client, request.params.id, body.reason),
    );
    reply.code(202);
    return result;
  });

  app.post<{ Params: { id: string } }>('/api/v1/documents/:id/amendments', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'review');
    const body = parseBody(amendmentLinkSchema, request.body);
    return withActorTx(ctx, request, (client) =>
      linkAmendment(
        client,
        request.params.id,
        body.completedUploadSessionId,
        body.expectedDocumentVersionId,
        body.reason,
      ),
    );
  });

  app.post<{ Params: { id: string } }>(
    '/api/v1/documents/:id/review-revisions',
    async (request, reply) => {
      const actor = requireActor(request);
      requireCapability(actor, 'review');
      const body = parseBody(reviewRevisionSchema, request.body);
      const result = await withActorTx(ctx, request, (client) =>
        createReviewRevision(
          client,
          request.params.id,
          body.expectedApprovalRevision,
          body.reason,
        ),
      );
      reply.code(201);
      return result;
    },
  );

  /**
   * Source access always reauthorizes and returns a short-lived URL. The page is a
   * hint for the viewer; access is granted per document version.
   */
  app.get<{ Params: { id: string }; Querystring: { versionId?: string; page?: string } }>(
    '/api/v1/documents/:id/source',
    async (request) => {
      const actor = requireActor(request);
      const versionId = request.query.versionId;
      const page = request.query.page ? Number(request.query.page) : 1;
      if (!Number.isInteger(page) || page < 1 || page > 10) throw ApiError.validation('Choose a valid source page.');
      return withActorTx(ctx, request, async (client) => {
        const document = await getDocumentRow(client, request.params.id);
        if (!document) throw ApiError.notFound('That document is not available.');
        const versions = await documentVersions(client, request.params.id);
        const version = versionId
          ? versions.find((item) => item.documentVersionId === versionId)
          : versions.find((item) => item.isCurrent);
        if (!version) throw ApiError.notFound('That document version is not available.');
        const row = await getDocumentSource(client, version.documentVersionId, page);
        if (!row) throw ApiError.notFound('That document version has no source object.');
        const url = await ctx.storage.createDownloadUrl(
          ctx.config.STORAGE_BUCKET_SOURCES,
          row.objectPath,
          DOWNLOAD_URL_SECONDS,
        );
        return {
          documentId: request.params.id,
          documentVersionId: version.documentVersionId,
          documentName: row.filename,
          page,
          pageCount: row.pageCount,
          url,
          expiresAt: new Date(Date.now() + DOWNLOAD_URL_SECONDS * 1000).toISOString(),
          authorizedActor: actor.profile.userId,
        };
      });
    },
  );

  app.get<{ Params: { id: string } }>('/api/v1/jobs/:id', async (request) => {
    requireActor(request);
    return withActorTx(ctx, request, async (client) => {
      const job = await getJobDto(client, request.params.id);
      if (!job) throw ApiError.notFound('That task is not available.');
      return job;
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/jobs/:id/stages', async (request) => {
    requireActor(request);
    return withActorTx(ctx, request, async (client) => {
      const job = await getJobDto(client, request.params.id);
      if (!job) throw ApiError.notFound('That task is not available.');
      return { jobId: job.jobId, state: job.state, observedStages: job.observedStages };
    });
  });
}
