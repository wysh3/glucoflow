import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import type { CareApplicableSkill, CareChatResult } from '@glucoflow/contracts';
import { createHermesBridge } from '../../apps/api/src/care/chat';
import { seedCareWorkspace } from '../../apps/api/src/care/seed';

const workspace = seedCareWorkspace(new Date());
const orderA = workspace.orders[0]!;
const orderB = workspace.orders[1]!;
const eventA = workspace.events.find(event => event.orderId === orderA.id)!;
const eventB = workspace.events.find(event => event.orderId === orderB.id && event.kind === 'specimen_collected')!;
const applicable = {
  id: randomUUID(), title: 'Verify specimen receipt', version: 1, pattern: 'specimen_receipt',
  encounterId: orderB.encounterId, orderId: orderB.id,
} satisfies CareApplicableSkill;
const proposal = {
  kind: 'monitor', title: applicable.title, body: applicable.pattern, skillId: applicable.id,
  encounterId: applicable.encounterId, orderId: applicable.orderId,
} as const;
let response: CareChatResult;
let responseDelayMs = 0;
const sidecar = createServer((_request, reply) => {
  reply.writeHead(200, { 'content-type': 'application/json', connection: 'close' });
  const payload = JSON.stringify(response);
  if (responseDelayMs) setTimeout(() => reply.end(payload), responseDelayMs);
  else reply.end(payload);
});

beforeAll(async () => {
  await new Promise<void>(resolve => sidecar.listen(0, '127.0.0.1', resolve));
  const address = sidecar.address();
  if (!address || typeof address === 'string') throw new Error('Test sidecar did not bind.');
  vi.stubEnv('HERMES_URL', `http://127.0.0.1:${address.port}`);
  vi.stubEnv('HERMES_SERVICE_TOKEN', 'local-synthetic-bridge-test-token');
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await new Promise<void>(resolve => sidecar.close(() => resolve()));
});

function chat(sources: string[], proposals: CareChatResult['proposals'] = [proposal]) {
  response = { reply: 'Synthetic workflow reply', engine: 'hermes', sources, proposals };
  return createHermesBridge().chat(workspace, 'Review operational evidence', 'local-synthetic-bridge-test', [applicable]);
}

it.each([
  ['only another encounter', [eventA.id]],
  ['the target and another encounter', [eventB.id, eventA.id]],
  ['no event', []],
] as const)('rejects a skill proposal that cites %s', async (_label, sources) => {
  await expect(chat([...sources])).rejects.toMatchObject({ status: 502, code: 'hermes_invalid_response' });
});

it('accepts a skill proposal with the exact triggering event for its target', async () => {
  await expect(chat([eventB.id])).resolves.toMatchObject({ sources: [eventB.id], proposals: [proposal] });
});

it('accepts a multi-encounter overview without a skill proposal', async () => {
  await expect(chat([eventA.id, eventB.id], [])).resolves.toMatchObject({ sources: [eventA.id, eventB.id], proposals: [] });
});


it('cancels an in-flight reply and releases its workspace admission slot', async () => {
  response = { reply: 'Verified reply', engine: 'hermes', sources: [], proposals: [] };
  responseDelayMs = 100;
  const bridge = createHermesBridge();
  const controller = new AbortController();
  const received = new Promise<void>(resolve => sidecar.once('request', () => resolve()));
  const pending = bridge.chat(workspace, 'Review pending work', 'cancel-test', [], 'en-IN', controller.signal);
  const rejected = expect(pending).rejects.toMatchObject({ status: 499, code: 'chat_cancelled' });
  await received;
  await expect(bridge.chat(workspace, 'Duplicate', 'busy')).rejects.toMatchObject({ code: 'chat_in_progress' });
  controller.abort();
  await rejected;
  responseDelayMs = 0;
  await expect(bridge.chat(workspace, 'Try again', 'after-cancel')).resolves.toMatchObject({ reply: 'Verified reply' });
});

it('does not dispatch an already cancelled turn', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(createHermesBridge().chat(workspace, 'Cancelled', 'pre-cancel', [], 'en-IN', controller.signal))
    .rejects.toMatchObject({ status: 499, code: 'chat_cancelled' });
});

it('does not discard a validated answer when telemetry throws', async () => {
  response = { reply: 'Verified reply', engine: 'hermes', sources: [], proposals: [] };
  const bridge = createHermesBridge(() => { throw new Error('Telemetry unavailable'); });
  await expect(bridge.chat(workspace, 'Pending work', 'telemetry-test')).resolves.toMatchObject({ reply: 'Verified reply' });
});
