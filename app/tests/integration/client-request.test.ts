import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, fetchPublicConfig } from '../../apps/client/src/lib/api';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const client = () => createApiClient({ baseUrl: 'https://example.test', getToken: () => null });
function hangingFetch() {
  vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal.reason), { once: true });
  })));
}
describe('bounded browser requests', () => {
  it('releases a hanging request without retrying writes', async () => {
    vi.useFakeTimers(); hangingFetch();
    const pending = client().request('/write', { method: 'POST', timeoutMs: 100 });
    const check = expect(pending).rejects.toMatchObject({ code: 'request_timeout' });
    await vi.advanceTimersByTimeAsync(101); await check;
    expect(fetch).toHaveBeenCalledTimes(1);
  }, 1000);
  it('distinguishes cancellation from being offline', async () => {
    hangingFetch(); const controller = new AbortController();
    const pending = client().request('/read', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'request_cancelled' });
  });
  it('releases the caller even when transport ignores abort', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const controller = new AbortController();
    const pending = client().request('/chat', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'request_cancelled' });
  }, 200);
  it('does not accept a late chat response after Stop and never retries it', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      status: 200, ok: true,
      text: async () => { controller.abort(); return JSON.stringify({ revision: 99 }); },
    })));
    await expect(client().request('/chat', { method: 'POST', signal: controller.signal }))
      .rejects.toMatchObject({ code: 'request_cancelled' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('bounds initial configuration so entry cannot spin indefinitely', async () => {
    vi.useFakeTimers(); hangingFetch();
    const check = expect(fetchPublicConfig('https://example.test')).rejects.toMatchObject({ code: 'request_timeout' });
    await vi.advanceTimersByTimeAsync(10001); await check;
  }, 1000);
  it('reports a non-JSON gateway failure without a parse error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })));
    await expect(client().request('/read')).rejects.toMatchObject({ status: 502, code: 'request_failed' });
  });
});
