import { beforeAll, afterAll, expect, it } from 'vitest';
import { buildServer } from '../../apps/api/src/server';
import { createAppContext } from '../../apps/api/src/context';
import { signLocalToken } from '../../apps/api/src/auth';
import {
  createFixture,
  createTestContext,
  removeClinic,
  type TestContext,
  type TestFixture,
} from './harness';
let ctx: TestContext,
  f: TestFixture,
  app: Awaited<ReturnType<typeof buildServer>>,
  token: string;
beforeAll(async () => {
  ctx = await createTestContext();
  f = await createFixture(ctx, 'guide');
  const api = await createAppContext();
  api.config = { ...api.config, GUIDE_MODE: 'local' };
  app = await buildServer(api);
  token = (
    await signLocalToken(api.config, {
      userId: f.patientUserId,
      email: 'synthetic@glucoflow.demo',
    })
  ).accessToken;
});
afterAll(async () => {
  await app.close();
  await removeClinic(ctx, f.clinicId);
  await removeClinic(ctx, f.otherClinicId);
  await ctx.close();
});
const send = (body: Record<string, unknown>, authenticated = true) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/guide',
    headers: authenticated ? { authorization: `Bearer ${token}` } : {},
    payload: body,
  });
it('requires a verified session', async () => {
  expect(
    (await send({ screen: 'records', message: 'help' }, false)).statusCode,
  ).toBe(401);
});
it('rejects client-supplied roles, patient ids and oversized messages', async () => {
  for (const body of [
    { screen: 'records', message: 'help', role: 'clinic' },
    { screen: 'records', message: 'help', patientId: f.patientId },
    { screen: 'records', message: 'a'.repeat(601) },
  ])
    expect((await send(body)).statusCode).toBe(422);
});
it('returns role-scoped navigation and refuses medical requests', async () => {
  const help = await send({
    screen: 'records',
    message: 'where do I upload a report?',
  });
  expect(help.statusCode).toBe(200);
  expect(help.json()).toMatchObject({
    mode: 'local',
    actions: [{ id: 'upload', label: 'Add report' }],
  });
  const refusal = await send({
    screen: 'records',
    message: 'diagnose me and prescribe treatment',
  });
  expect(refusal.json().message).toContain('cannot diagnose');
  expect(refusal.json().actions).toEqual([]);
});
it('bounds requests per verified actor', async () => {
  const results = [];
  for (let i = 0; i < 13; i++)
    results.push(
      (await send({ screen: 'records', message: 'help' })).statusCode,
    );
  expect(results).toContain(429);
});
