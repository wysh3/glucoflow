import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SupabaseStorageAdapter } from '@glucoflow/data/storage';

/**
 * Hosted storage, verified against a local Storage API stub.
 *
 * This does **not** contact Supabase. The stub speaks the documented Storage REST
 * endpoints and checks the adapter's own behaviour: service-key authentication, private
 * bucket paths, short-lived signed URLs, metadata, download, delete, and refusal of a
 * path that escapes its bucket.
 *
 * A real hosted bucket still has to be exercised before the deployed system can be called
 * verified; that remains outstanding and is reported as such.
 */

let storageServer: Server;
let storageUrl = '';
const storageCalls: { method: string; path: string; authorization: string | null }[] = [];
const objects = new Map<string, Buffer>();

beforeAll(async () => {
  storageServer = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      storageCalls.push({
        method: request.method ?? 'GET',
        path: url.pathname,
        authorization: request.headers.authorization ?? null,
      });
      const rest = url.pathname.replace(/^\/storage\/v1/, '');
      const json = (status: number, payload: unknown): void => {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(payload));
      };

      if (request.method === 'PUT' && rest.startsWith('/object/upload/sign/')) {
        if (url.searchParams.get('token') !== 'stub-upload-token') {
          json(403, { error: 'invalid upload token' });
          return;
        }
        const key = decodeURIComponent(rest.replace('/object/upload/sign/', ''));
        objects.set(key, Buffer.concat(chunks));
        json(200, { Key: key });
        return;
      }
      if (request.method === 'POST' && rest.startsWith('/object/upload/sign/')) {
        const key = decodeURIComponent(rest.replace('/object/upload/sign/', ''));
        json(200, { url: `/object/upload/sign/${key}?token=stub-upload-token` });
        return;
      }
      if (request.method === 'POST' && rest.startsWith('/object/sign/')) {
        const key = decodeURIComponent(rest.replace('/object/sign/', ''));
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as { expiresIn?: number };
        json(200, {
          signedURL: `/object/sign/${key}?token=stub-read-token&expires=${body.expiresIn ?? 60}`,
        });
        return;
      }
      if (request.method === 'GET' && rest.startsWith('/object/info/')) {
        const key = decodeURIComponent(rest.replace('/object/info/', ''));
        const stored = objects.get(key);
        if (!stored) {
          json(404, { error: 'not found' });
          return;
        }
        json(200, { size: stored.length, created_at: new Date().toISOString() });
        return;
      }
      if (request.method === 'POST' && rest.startsWith('/object/')) {
        const key = decodeURIComponent(rest.replace('/object/', ''));
        objects.set(key, Buffer.concat(chunks));
        json(200, { Key: key });
        return;
      }
      if (request.method === 'GET' && rest.startsWith('/object/sign/')) {
        // A signed URL resolves to the object it names.
        const key = decodeURIComponent(rest.replace('/object/sign/', ''));
        const stored = objects.get(key);
        if (!stored) {
          json(404, { error: 'not found' });
          return;
        }
        response.writeHead(200, { 'content-type': 'application/octet-stream' });
        response.end(stored);
        return;
      }
      if (request.method === 'GET' && rest.startsWith('/object/')) {
        const key = decodeURIComponent(rest.replace('/object/', ''));
        const stored = objects.get(key);
        if (!stored) {
          json(404, { error: 'not found' });
          return;
        }
        response.writeHead(200, { 'content-type': 'application/octet-stream' });
        response.end(stored);
        return;
      }
      if (request.method === 'DELETE' && rest.startsWith('/object/')) {
        objects.delete(decodeURIComponent(rest.replace('/object/', '')));
        json(200, { message: 'removed' });
        return;
      }
      json(400, { error: 'unsupported stub route' });
    });
  });
  await new Promise<void>((resolve) => storageServer.listen(0, '127.0.0.1', resolve));
  const address = storageServer.address();
  if (address === null || typeof address === 'string') throw new Error('storage stub did not bind');
  storageUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => storageServer.close(() => resolve()));
});

describe('hosted storage (Storage API stub, not a Supabase bucket)', () => {
  const adapter = (): SupabaseStorageAdapter =>
    new SupabaseStorageAdapter({
      supabaseUrl: storageUrl,
      serviceKey: 'stub-service-key-not-a-credential',
    });

  const SOURCE_PATH = 'clinics/a/patients/b/uploads/c/00-x.pdf';

  it('uploads an object to a private bucket with the service key', async () => {
    const bytes = Buffer.from('%PDF-1.4 stub object');
    await adapter().putObject('sutra-sources', SOURCE_PATH, bytes, 'application/pdf');

    const call = storageCalls.at(-1)!;
    expect(call.method).toBe('POST');
    expect(call.path).toBe(`/storage/v1/object/sutra-sources/${SOURCE_PATH}`);
    expect(call.authorization).toBe('Bearer stub-service-key-not-a-credential');
    expect(objects.get(`sutra-sources/${SOURCE_PATH}`)?.toString()).toBe(bytes.toString());
  });

  it('issues an upload URL whose token is carried separately from the object path', async () => {
    const upload = await adapter().createUploadUrl('sutra-sources', SOURCE_PATH, 900);
    expect(upload.method).toBe('PUT');
    expect(upload.token).toBe('stub-upload-token');
    const bytes = Buffer.from('%PDF-1.4 signed upload');
    const response = await fetch(upload.uploadUrl, { method: upload.method, body: bytes });
    expect(response.status).toBe(200);
    expect(storageCalls.at(-1)?.authorization).toBeNull();
    expect(objects.get(`sutra-sources/${SOURCE_PATH}`)).toEqual(bytes);
    expect(upload.uploadUrl).toContain('/object/upload/sign/sutra-sources/');
    // The provider issues two hour tokens; the application window is shorter.
    expect(new Date(upload.expiresAt).getTime()).toBeLessThanOrEqual(Date.now() + 900_000 + 1_000);
  });

  it('issues a short-lived download URL and serves the object through it', async () => {
    const url = await adapter().createDownloadUrl('sutra-sources', SOURCE_PATH, 60);
    expect(url).toContain('token=stub-read-token');
    expect(url).toContain('expires=60');

    const response = await fetch(new URL(url, storageUrl));
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer()).toString()).toContain('%PDF-1.4');
  });

  it('reports object metadata, reads bytes back and deletes for retention', async () => {
    const head = await adapter().headObject('sutra-sources', SOURCE_PATH);
    expect(head?.bytes).toBeGreaterThan(0);

    const bytes = await adapter().getObject('sutra-sources', SOURCE_PATH);
    expect(bytes.toString()).toContain('%PDF-1.4');

    await adapter().deleteObject('sutra-sources', SOURCE_PATH);
    expect(objects.has(`sutra-sources/${SOURCE_PATH}`)).toBe(false);
    expect(storageCalls.at(-1)!.method).toBe('DELETE');
  });

  it('returns null for an object that is not there', async () => {
    expect(await adapter().headObject('sutra-sources', 'clinics/missing/00-x.pdf')).toBeNull();
  });

  it('refuses a path that escapes its bucket', async () => {
    await expect(adapter().getObject('sutra-sources', '../../etc/passwd')).rejects.toThrow(
      /unsafe object path/,
    );
    // The request never left the process.
    expect(storageCalls.every((call) => !call.path.includes('passwd'))).toBe(true);
  });
});
