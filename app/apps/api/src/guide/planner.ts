import { z } from 'zod';
import { readBoundedJson, type HermesBridgeConfig } from '../hermes/bridge';

const model = 'gpt-6-luna' as const;
const maxRequestBytes = 32 * 1024;
const maxResponseBytes = 16 * 1024;
const tokenCount = z.number().int().nonnegative().nullable();

const planResponse = z.strictObject({
  engine: z.literal('hermes'),
  runtimeVersion: z.literal('0.23.0'),
  model: z.literal(model),
  choices: z.tuple([z.strictObject({
    message: z.strictObject({ content: z.string().min(1).max(4000) }),
  })]),
  usage: z.strictObject({ prompt_tokens: tokenCount, completion_tokens: tokenCount }),
});

export function createGuideBudget(hourlyLimit: number, maxConcurrent: number) {
  let hour = Math.floor(Date.now() / 3600000);
  let calls = 0;
  let active = 0;
  return {
    acquire(): (() => void) | null {
      const current = Math.floor(Date.now() / 3600000);
      if (current !== hour) {
        hour = current;
        calls = 0;
      }
      if (calls >= hourlyLimit || active >= maxConcurrent) return null;
      calls++;
      active++;
      return () => { active--; };
    },
  };
}

export type GuideConfig = {
  budget?: ReturnType<typeof createGuideBudget>;
  mode: 'live' | 'local';
  hermes: HermesBridgeConfig | null;
  hourlyLimit: number;
  timeoutMs: number;
  maxConcurrent: number;
};

/** Send one fixed planning intent to Hermes. Caller-owned schemas and rendering remain authoritative. */
export function createGuidePlanner(config: GuideConfig) {
  const budget = config.budget ?? createGuideBudget(config.hourlyLimit, config.maxConcurrent);
  return {
    async plan<T>(prompt: string, input: object, outputTokens: number, schema: z.ZodType<T>) {
      if (config.mode !== 'live' || !config.hermes) return null;
      const body = JSON.stringify({
        model,
        max_completion_tokens: outputTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: JSON.stringify(input) },
        ],
      });
      if (Buffer.byteLength(body, 'utf8') > maxRequestBytes) return null;
      const release = budget.acquire();
      if (!release) return null;
      try {
        const response = await fetch(new URL('/record-plan', config.hermes.url), {
          method: 'POST',
          redirect: 'error',
          headers: { authorization: `Bearer ${config.hermes.token}`, 'content-type': 'application/json' },
          signal: AbortSignal.timeout(config.timeoutMs),
          body,
        });
        if (!response.ok) {
          await response.body?.cancel().catch(() => undefined);
          return null;
        }
        const envelope = planResponse.parse(await readBoundedJson(response, maxResponseBytes));
        const data = schema.parse(JSON.parse(envelope.choices[0].message.content));
        return { data, model: envelope.model };
      } catch {
        return null;
      } finally {
        release();
      }
    },
  };
}
