import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  ACCEPTED_FILE_TYPES,
  UPLOAD_MAX_BYTES,
  UPLOAD_MAX_PAGES,
  UPLOAD_MAX_PHOTOS,
  STORAGE_UPLOAD_TOKEN_SECONDS,
  createUploadSchema,
  type UploadSessionDto,
} from '@glucoflow/contracts';
import {
  cancelUploadSession,
  completeUploadSession,
  createUploadSession,
  loadUploadSession,
  listPendingUploads,
} from '@glucoflow/data';
import { ApiError } from '../errors';
import { idempotencyKey, parseBody, requireActor, withActorTx } from './helpers';
import type { AppContext } from '../context';

/** Magic-byte checks. The extension and the declared MIME type are not trusted. */
export function detectFileKind(bytes: Buffer): 'pdf' | 'jpeg' | 'png' | null {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png';
  }
  return null;
}

export function isEncryptedPdf(bytes: Buffer): boolean {
  // An /Encrypt entry in the trailer indicates an encrypted document.
  const text = bytes.subarray(0, Math.min(bytes.length, 4_000_000)).toString('latin1');
  return /\/Encrypt\b/.test(text);
}

export function registerUploadRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post('/api/v1/uploads', async (request, reply) => {
    const actor = requireActor(request);
    const body = parseBody(createUploadSchema, request.body);
    const key = idempotencyKey(request, true);

    // Manifest validation happens before any row is written.
    const images = new Set(['image/jpeg', 'image/png']);
    if (body.kind === 'file' && body.files.length !== 1) {
      throw ApiError.validation('A file upload contains exactly one document.', {
        files: 'exactly one file is required for kind=file',
      });
    }
    if (body.kind === 'photos' && (body.files.length < 1 || body.files.length > UPLOAD_MAX_PHOTOS)) {
      throw ApiError.validation(`A photo batch contains 1 to ${UPLOAD_MAX_PHOTOS} images.`, {
        files: 'photo count out of range',
      });
    }
    let totalBytes = 0;
    for (const file of body.files) {
      if (file.byteCount > UPLOAD_MAX_BYTES) {
        throw ApiError.tooLarge(
          `${file.filename} is larger than 15 MiB. Reduce the file size and try again.`,
        );
      }
      totalBytes += file.byteCount;
      if (body.kind === 'photos' && !images.has(file.contentType)) {
        throw ApiError.validation('A photo batch accepts JPEG or PNG images only.', {
          files: `${file.filename} is not a JPEG or PNG`,
        });
      }
    }
    if (totalBytes > UPLOAD_MAX_BYTES) {
      throw ApiError.tooLarge('The upload is larger than 15 MiB in total.');
    }
    if (
      !actor.capabilities.patientIds.includes(body.patientId) &&
      actor.capabilities.clinicIds.length === 0
    ) {
      throw ApiError.forbidden('This account cannot upload for that patient.');
    }

    const session = await withActorTx(ctx, request, (client) =>
      createUploadSession(client, {
        patientId: body.patientId,
        kind: body.kind,
        files: body.files,
        idempotencyKey: key,
      }),
    );

    const items = await Promise.all(
      session.items.map(async (item) => {
        if (session.reused) {
          // A repeated creation returns the same paths; a fresh signature is issued
          // per response so no signed URL is stored anywhere.
          const signed = await ctx.storage.createUploadUrl(
            ctx.config.STORAGE_BUCKET_SOURCES,
            item.objectPath,
            STORAGE_UPLOAD_TOKEN_SECONDS,
          );
          return {
            objectPath: item.objectPath,
            filename: item.filename,
            contentType: item.contentType,
            byteCount: Number(item.byteCount),
            method: signed.method,
            uploadUrl: signed.uploadUrl,
            uploadToken: signed.token,
          };
        }
        const signed = await ctx.storage.createUploadUrl(
          ctx.config.STORAGE_BUCKET_SOURCES,
          item.objectPath,
          STORAGE_UPLOAD_TOKEN_SECONDS,
        );
        return {
          objectPath: item.objectPath,
          filename: item.filename,
          contentType: item.contentType,
          byteCount: Number(item.byteCount),
          method: signed.method,
          uploadUrl: signed.uploadUrl,
          uploadToken: signed.token,
        };
      }),
    );

    const dto: UploadSessionDto = {
      sessionId: session.sessionId,
      patientId: body.patientId,
      clinicId: actor.contexts.find(
        (context) => context.kind === 'patient' && context.patientId === body.patientId,
      )?.clinicId ??
        actor.contexts.find((context) => context.kind === 'clinic')?.clinicId ??
        '',
      kind: session.kind,
      state: 'created',
      items,
      createdAt: new Date().toISOString(),
      completionExpiresAt: session.completionExpiresAt,
      providerTokenExpiresAt: session.providerTokenExpiresAt,
    };
    reply.code(201);
    return dto;
  });

  app.post<{ Params: { id: string } }>('/api/v1/uploads/:id/complete', async (request, reply) => {
    requireActor(request);
    const result = await withActorTx(ctx, request, async (client) => {
      const session = await loadUploadSession(client, request.params.id);
      if (!session) throw ApiError.notFound('That upload session is not available.');
      if (session.state === 'completed') {
        const completed = await completeUploadSession(client, session.sessionId, '', 0, null);
        return {
          documentId: completed.documentId,
          jobId: completed.jobId,
          duplicateOfDocumentId: null,
          pageCount: null,
          state: 'completed',
        };
      }
      if (session.state === 'cancelled') {
        throw ApiError.conflict('This upload was cancelled.');
      }

      // Every declared object must exist, match its declared size and pass a magic
      // byte check before the manifest is frozen.
      const itemHashes: { objectPath: string; sha256: string }[] = [];
      let totalBytes = 0;
      for (const item of session.items) {
        const head = await ctx.storage.headObject(
          ctx.config.STORAGE_BUCKET_SOURCES,
          item.objectPath,
        );
        if (!head) {
          throw ApiError.validation(
            `The upload is incomplete: ${item.filename} has not arrived yet.`,
            { files: `${item.filename} is missing` },
          );
        }
        if (head.bytes > UPLOAD_MAX_BYTES) {
          throw ApiError.tooLarge(`${item.filename} is larger than 15 MiB.`);
        }
        const bytes = await ctx.storage.getObject(
          ctx.config.STORAGE_BUCKET_SOURCES,
          item.objectPath,
        );
        const kind = detectFileKind(bytes);
        if (!kind) {
          throw ApiError.validation(
            `${item.filename} is not a PDF, JPEG or PNG file. Upload a supported document.`,
            { files: `${item.filename} failed the file signature check` },
          );
        }
        if (kind === 'pdf' && isEncryptedPdf(bytes)) {
          throw ApiError.validation(
            `${item.filename} looks password protected. Remove the password and upload it again.`,
            { files: 'encrypted PDF' },
          );
        }
        itemHashes.push({
          objectPath: item.objectPath,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        });
        totalBytes += bytes.length;
      }
      if (totalBytes > UPLOAD_MAX_BYTES) {
        throw ApiError.tooLarge('The upload is larger than 15 MiB in total.');
      }
      // The ordered source manifest hash covers the verified object hashes only, so
      // two uploads of the same file are recognised as exact duplicates.
      const manifestChecksum = createHash('sha256')
        .update(itemHashes.map((item) => item.sha256).join('\n'))
        .digest('hex');

      const completed = await completeUploadSession(
        client,
        session.sessionId,
        manifestChecksum,
        totalBytes,
        null,
      );
      return {
        documentId: completed.documentId,
        jobId: completed.jobId,
        duplicateOfDocumentId: null,
        pageCount: null,
        state: 'queued',
      };
    });
    reply.code(202);
    return result;
  });

  app.delete<{ Params: { id: string } }>('/api/v1/uploads/:id', async (request) => {
    requireActor(request);
    return withActorTx(ctx, request, (client) => cancelUploadSession(client, request.params.id));
  });

  app.get('/api/v1/uploads/pending', async (request) => {
    const actor = requireActor(request);
    return withActorTx(ctx, request, (client) =>
      listPendingUploads(client, actor.profile.userId),
    );
  });

  app.get<{ Params: { id: string } }>('/api/v1/uploads/:id', async (request) => {
    requireActor(request);
    return withActorTx(ctx, request, async (client) => {
      const session = await loadUploadSession(client, request.params.id);
      if (!session) throw ApiError.notFound('That upload session is not available.');
      return session;
    });
  });
}

export const uploadLimits = {
  UPLOAD_MAX_BYTES,
  UPLOAD_MAX_PAGES,
  UPLOAD_MAX_PHOTOS,
  acceptedFileTypes: ACCEPTED_FILE_TYPES,
};

/**
 * Signed storage endpoints for the local adapter. The signature is verified before
 * any byte is read or written, expiry is enforced, and an existing object is never
 * overwritten.
 */
export function registerStorageRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.addContentTypeParser(
    ['application/pdf', 'image/jpeg', 'image/png', 'application/octet-stream'],
    { parseAs: 'buffer', bodyLimit: UPLOAD_MAX_BYTES + 1024 },
    (_request, body, done) => done(null, body),
  );

  const paramsSchema = z.object({
    bucket: z.string().min(1).max(64),
    '*': z.string().min(1).max(512),
  });

  app.put('/api/v1/storage/object/:bucket/*', async (request, reply) => {
    if (ctx.storage.mode !== 'local') throw ApiError.notFound('Not found.');
    const params = paramsSchema.parse(request.params);
    const query = z
      .object({
        expires: z.string(),
        token: z.string().optional(),
        signature: z.string(),
      })
      .parse(request.query);
    const objectPath = params['*'];
    const payload = `${params.bucket}|${objectPath}|PUT|${query.expires}|${query.token ?? ''}`;
    if (!ctx.storage.verifySignature?.(payload, query.signature)) {
      reply.code(403);
      return { error: { code: 'invalid_token', message: 'This upload link is not valid.', requestId: request.id } };
    }
    if (Number(query.expires) * 1000 < Date.now()) {
      reply.code(403);
      return { error: { code: 'expired', message: 'This upload link has expired.', requestId: request.id } };
    }
    const body = request.body;
    if (!Buffer.isBuffer(body)) {
      throw ApiError.validation('The upload body could not be read.');
    }
    try {
      await ctx.storage.putObject(
        params.bucket,
        objectPath,
        body,
        String(request.headers['content-type'] ?? 'application/octet-stream'),
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'StorageError') {
        throw ApiError.conflict('This upload link was already used.');
      }
      throw error;
    }
    reply.code(201);
    return { ok: true, bytes: body.length };
  });

  app.get('/api/v1/storage/object/:bucket/*', async (request, reply) => {
    if (ctx.storage.mode !== 'local') throw ApiError.notFound('Not found.');
    const params = paramsSchema.parse(request.params);
    const query = z
      .object({ expires: z.string(), signature: z.string() })
      .parse(request.query);
    const objectPath = params['*'];
    const payload = `${params.bucket}|${objectPath}|GET|${query.expires}|`;
    if (!ctx.storage.verifySignature?.(payload, query.signature)) {
      reply.code(403);
      return { error: { code: 'invalid_token', message: 'This link is not valid.', requestId: request.id } };
    }
    if (Number(query.expires) * 1000 < Date.now()) {
      reply.code(403);
      return { error: { code: 'expired', message: 'This link has expired. Reopen the source.', requestId: request.id } };
    }
    const bytes = await ctx.storage.getObject(params.bucket, objectPath);
    const name = objectPath.split('/').pop() ?? 'source';
    reply
      .header('cache-control', 'no-store')
      .header('content-type', guessContentType(name))
      .header('content-disposition', `inline; filename="${sanitizeFilename(name)}"`);
    return reply.send(bytes);
  });
}

function guessContentType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120);
}

export function requestSummary(request: FastifyRequest): string {
  return `${request.method} ${request.url.split('?')[0]}`;
}
