import { describe, expect, it, vi, afterEach } from 'vitest';
import { createApiClient } from '../../apps/client/src/lib/api';
const encoder = new TextEncoder();
const client = () => createApiClient({ baseUrl: 'https://example.test', getToken: () => null });
afterEach(() => vi.unstubAllGlobals());
describe('public chat lifecycle stream', () => {
  it('shows only ordered allowlisted stages before the final workspace', async () => {
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ start(c) { stream = c; } }), {
      headers: { 'content-type': 'application/x-ndjson' },
    })));
    const progress = vi.fn();
    const pending = client().request('/chat', { method: 'POST', onProgress: progress });
    await Promise.resolve();
    stream.enqueue(encoder.encode('{"type":"progress","sequence":1,"stage":"reading_sources"}\n'));
    await vi.waitFor(() => expect(progress).toHaveBeenCalledWith('reading_sources'));
    stream.enqueue(encoder.encode('{"type":"progress","sequence":0,"stage":"context"}\n{"type":"progress","sequence":2,"stage":"private_reasoning"}\n{"type":"result","workspace":{"revision":8}}\n'));
    await expect(pending).resolves.toEqual({ revision: 8 });
    expect(progress).toHaveBeenCalledTimes(1);
  });
  it('releases a stalled response body on cancellation without accepting late output', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({}), {
      headers: { 'content-type': 'application/x-ndjson' },
    })));
    const pending = client().request('/chat', { signal: controller.signal, onProgress: vi.fn() });
    await Promise.resolve(); controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'request_cancelled' });
  });
  it('rejects a truncated stream instead of inventing a completed reply', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"type":"progress","sequence":1,"stage":"model"}\n', {
      headers: { 'content-type': 'application/x-ndjson' },
    })));
    await expect(client().request('/chat', { onProgress: vi.fn() })).rejects.toMatchObject({ code: 'request_interrupted' });
  });
});
