import { z } from 'zod';

/** Public action telemetry, never model thoughts, prompts, tool arguments or patient data. */
export const careProgressStage = z.enum([
  'context', 'starting', 'model', 'reading_sources', 'preparing_reply', 'validating', 'saving',
]);
export type CareProgressStage = z.infer<typeof careProgressStage>;
const frameSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('progress'), stage: careProgressStage }),
  z.strictObject({ type: z.literal('result'), status: z.number().int().min(200).max(599), payload: z.unknown(), timing: z.unknown().optional() }),
]);

/** The private runtime stream is bounded and parsed before any event is exposed. */
export async function readCareRuntimeStream(response: Response, onProgress: (stage: CareProgressStage) => void) {
  if (!response.body) throw new Error('Missing runtime stream');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0, frames = 0, pending = '';
  let result: { type: 'result'; status: number; payload?: unknown; timing?: unknown } | undefined;
  const consume = (line: string) => {
    if (!line.trim()) return;
    if (++frames > 32 || result) throw new Error('Unexpected runtime frames');
    const frame = frameSchema.parse(JSON.parse(line));
    if (frame.type === 'progress') onProgress(frame.stage);
    else result = frame;
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 96 * 1024) throw new Error('Runtime stream too large');
      pending += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = pending.indexOf('\n')) >= 0) {
        consume(pending.slice(0, newline)); pending = pending.slice(newline + 1);
      }
    }
    pending += decoder.decode();
    if (pending.trim()) consume(pending);
    if (!result) throw new Error('Runtime ended without a result');
    return result;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
