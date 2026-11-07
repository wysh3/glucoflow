import type { ServerResponse } from 'node:http';

/** A completed request body is not a disconnected client. Watch the response. */
export function responseLifetime(response: Pick<ServerResponse, 'on' | 'off' | 'writableEnded' | 'destroyed'>) {
  const controller = new AbortController();
  const closed = () => {
    if (!response.writableEnded) controller.abort();
  };
  response.on('close', closed);
  if (response.destroyed) closed();
  return {
    signal: controller.signal,
    dispose: () => response.off('close', closed),
  };
}
