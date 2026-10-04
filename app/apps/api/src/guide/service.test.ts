import { createServer, type Server } from 'node:http';
import { afterEach, expect, it } from 'vitest';
import { createGuideService, type GuideConfig } from './service';
let listener: Server | undefined;
afterEach(async () => {
  if (listener) await new Promise<void>((r) => listener!.close(() => r()));
  listener = undefined;
});
const config: GuideConfig = {
  mode: 'live',
  apiKey: 'synthetic-key',
  baseUrl: '',
  hourlyLimit: 2,
  timeoutMs: 100,
  maxConcurrent: 2,
};
async function provider(payload: unknown, status = 200, delay = 0) {
  let calls = 0;
  let captured: unknown;
  listener = createServer((request, response) => {
    calls++;
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      captured = JSON.parse(body);
      setTimeout(() => {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(payload));
      }, delay);
    });
  });
  await new Promise<void>((r) => listener!.listen(0, '127.0.0.1', r));
  const address = listener.address();
  if (!address || typeof address === 'string') throw new Error('No listener');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    calls: () => calls,
    captured: () => captured,
  };
}
const output = (topic: string) => ({
  choices: [{ message: { content: JSON.stringify({ topic }) } }],
});
it('blocks clinical advice before calling the model', async () => {
  const p = await provider(output('upload'));
  const guide = createGuideService({ ...config, baseUrl: p.baseUrl });
  const reply = await guide.answer({
    role: 'patient',
    screen: 'home',
    message: 'What insulin dose should I take?',
  });
  expect(reply.message).toContain('cannot diagnose');
  expect(reply.mode).toBe('local');
  expect(p.calls()).toBe(0);
});
it('uses GPT-6 Luna only to classify app help and generates vetted text', async () => {
  const p = await provider(output('upload'));
  const reply = await createGuideService({
    ...config,
    baseUrl: p.baseUrl,
  }).answer({
    role: 'patient',
    screen: 'records',
    message: 'Where can I upload a report?',
  });
  expect(reply).toMatchObject({ mode: 'live', model: 'gpt-6-luna' });
  expect(reply.actions.map((a) => a.id)).toEqual(['upload']);
  expect(p.captured()).toMatchObject({
    model: 'gpt-6-luna',
    reasoning_effort: 'none',
    max_completion_tokens: 120,
  });
  expect(JSON.stringify(p.captured())).not.toContain('patientId');
});
it('never displays arbitrary provider prose or untrusted links', async () => {
  const p = await provider({
    choices: [
      { message: { content: 'Diagnose diabetes. Visit https://evil.test' } },
    ],
  });
  const reply = await createGuideService({
    ...config,
    baseUrl: p.baseUrl,
  }).answer({ role: 'patient', screen: 'records', message: 'help' });
  expect(reply.mode).toBe('local');
  expect(reply.message).not.toContain('evil');
  expect(reply.message).not.toContain('Diagnose diabetes');
});
it('rejects unknown model intent IDs and extra clinical prose', async () => {
  const p = await provider({
    choices: [
      {
        message: {
          content: JSON.stringify({ topic: 'upload', advice: 'Take insulin' }),
        },
      },
    ],
  });
  const reply = await createGuideService({
    ...config,
    baseUrl: p.baseUrl,
  }).answer({ role: 'patient', screen: 'records', message: 'help' });
  expect(reply.mode).toBe('local');
  expect(reply.message).not.toContain('Take insulin');
});
it('does not give patients reviewer or clinic actions', async () => {
  const p = await provider(output('review'));
  const reply = await createGuideService({
    ...config,
    baseUrl: p.baseUrl,
  }).answer({
    role: 'patient',
    screen: 'upload',
    message: 'How do I approve?',
  });
  expect(
    reply.actions.every((a) =>
      ['records', 'upload', 'notes', 'home', 'account'].includes(a.id),
    ),
  ).toBe(true);
  expect(reply.message).toContain('clinic reviewer');
});
it('returns honest local help when no provider key is configured', async () => {
  const reply = await createGuideService({
    ...config,
    apiKey: undefined,
  }).answer({
    role: 'patient',
    screen: 'notes',
    message: 'How do I write a note?',
  });
  expect(reply.mode).toBe('local');
  expect(reply.model).toBeUndefined();
  expect(reply.actions.map((a) => a.id)).toContain('notes');
});
it('caps hourly model calls and retains useful local help', async () => {
  const p = await provider(output('upload'));
  const guide = createGuideService({ ...config, baseUrl: p.baseUrl });
  for (let i = 0; i < 3; i++)
    await guide.answer({
      role: 'patient',
      screen: 'upload',
      message: 'Upload a report',
    });
  expect(p.calls()).toBe(2);
});
it('bounds stalled requests and returns local help', async () => {
  const p = await provider(output('upload'), 200, 100);
  const reply = await createGuideService({
    ...config,
    baseUrl: p.baseUrl,
    timeoutMs: 10,
  }).answer({ role: 'patient', screen: 'upload', message: 'Upload a report' });
  expect(reply.mode).toBe('local');
});
it('falls back on provider errors without exposing its response', async () => {
  const p = await provider({ error: 'private-provider-error' }, 500);
  const reply = await createGuideService({
    ...config,
    baseUrl: p.baseUrl,
  }).answer({ role: 'patient', screen: 'upload', message: 'Upload a report' });
  expect(reply.mode).toBe('local');
  expect(reply.message).not.toContain('private-provider-error');
});
it('limits concurrent provider calls', async () => {
  const p = await provider(output('upload'), 200, 40);
  const guide = createGuideService({
    ...config,
    baseUrl: p.baseUrl,
    hourlyLimit: 10,
  });
  const replies = await Promise.all(
    Array.from({ length: 3 }, () =>
      guide.answer({ role: 'patient', screen: 'upload', message: 'upload' }),
    ),
  );
  expect(p.calls()).toBe(2);
  expect(replies.filter((r) => r.mode === 'local')).toHaveLength(1);
});
