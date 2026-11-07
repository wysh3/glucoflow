export type HermesBridgeConfig = { url: URL; token: string };

export function readHermesBridgeConfig(): HermesBridgeConfig | null {
  try {
    const url = new URL(process.env.HERMES_URL?.trim() ?? '');
    const token = process.env.HERMES_SERVICE_TOKEN?.trim() ?? '';
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        url.search || url.hash || token.length < 24) return null;
    return { url, token };
  } catch {
    return null;
  }
}

export async function readBoundedJson(response: Response, maxBytes: number): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty response.');
  const chunks: Buffer[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error('Response limit exceeded.');
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
