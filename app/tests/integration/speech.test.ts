import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { SPEECH_MAX_AUDIO_BYTES, type SpeechCapabilities } from '@glucoflow/contracts';
import { signLocalToken } from '../../apps/api/src/auth';
import { createAppContext, type AppContext } from '../../apps/api/src/context';
import { buildServer } from '../../apps/api/src/server';
import { createFixture, createTestContext, removeClinic, type TestContext, type TestFixture } from './harness';

const base = '/api/v1/speech';
let db: TestContext;
let fixture: TestFixture;
let api: AppContext;
let app: Awaited<ReturnType<typeof buildServer>>;
const tokens: Record<string, string> = {};
const unlinkedId = randomUUID();

beforeAll(async () => {
  db = await createTestContext();
  fixture = await createFixture(db, 'speech');
  await db.owner(async (client) => {
    await client.query('insert into sutra.app_users (id, email, display_name) values ($1, $2, $3)',
      [unlinkedId, `unlinked-${unlinkedId}@test.local`, 'Synthetic unlinked account']);
  });
  const local = await createAppContext();
  api = {
    ...local,
    config: { ...local.config, SARVAM_API_KEY: '', SARVAM_STT_MAX_SECONDS: 0, SARVAM_TTS_MAX_CHARACTERS: 0 },
  };
  app = await buildServer(api);
  for (const [role, userId] of Object.entries({ patient: fixture.patientUserId, clinician: fixture.clinicianId, unlinked: unlinkedId })) {
    tokens[role] = (await signLocalToken(api.config, { userId, email: 'synthetic@test.local' })).accessToken;
  }
});

afterAll(async () => {
  await app?.close();
  await api?.pool.end();
  if (fixture) {
    await db.owner(async (client) => { await client.query('delete from sutra.app_users where id = $1', [unlinkedId]); });
    await removeClinic(db, fixture.clinicId);
    await removeClinic(db, fixture.otherClinicId);
  }
  await db?.close();
});

const headers = (role = 'patient') => ({ authorization: `Bearer ${tokens[role]}` });
const reviewed = { text: 'Synthetic speech test.', languageCode: 'en-IN', reviewed: true };

it('requires a verified linked patient or clinic account and reports both modes as setup-required without a key', async () => {
  expect((await app.inject({ method: 'GET', url: `${base}/capabilities` })).statusCode).toBe(401);
  expect((await app.inject({ method: 'GET', url: `${base}/capabilities`, headers: headers('unlinked') })).statusCode).toBe(403);
  for (const role of ['patient', 'clinician']) {
    const reply = await app.inject({ method: 'GET', url: `${base}/capabilities`, headers: headers(role) });
    expect(reply.statusCode).toBe(200);
    expect(reply.headers['cache-control']).toBe('no-store');
    const capabilities = reply.json<SpeechCapabilities>();
    expect(capabilities).toMatchObject({ provider: 'sarvam', retention: 'workspace_setting_unverified' });
    expect(capabilities.stt).toMatchObject({ status: 'setup_required', maxAudioBytes: 960044, maxDurationSeconds: 30, sampleRate: 16000 });
    expect(capabilities.tts).toMatchObject({ status: 'setup_required', maxTextCharacters: 500 });
  }
});

it('rejects MIME spoofing, oversized audio and unreviewed synthesis before provider dispatch', async () => {
  const stub = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected provider call.'));
  try {
    const transcribe = (payload: Buffer, mediaType = 'audio/wav') => app.inject({
      method: 'POST', url: `${base}/transcribe`, payload, headers: { ...headers(), 'content-type': mediaType },
    });
    expect((await transcribe(Buffer.alloc(50), 'audio/webm')).statusCode).toBe(415);
    expect((await transcribe(Buffer.alloc(50))).statusCode).toBe(422);
    expect((await transcribe(Buffer.alloc(SPEECH_MAX_AUDIO_BYTES + 1))).statusCode).toBe(413);
    const synthesize = (payload: unknown) => app.inject({
      method: 'POST', url: `${base}/synthesize`, payload: JSON.stringify(payload),
      headers: { ...headers(), 'content-type': 'application/json' },
    });
    expect((await synthesize({ ...reviewed, reviewed: false })).statusCode).toBe(422);
    expect((await synthesize({ ...reviewed, text: 'A'.repeat(501) })).statusCode).toBe(422);
    const malformed = await app.inject({
      method: 'POST', url: `${base}/synthesize`, payload: 'synthetic private payload',
      headers: { ...headers(), 'content-type': 'application/json' },
    });
    expect(malformed.statusCode).toBe(422);
    expect(malformed.body).not.toContain('synthetic private payload');
    const setup = await synthesize(reviewed);
    expect(setup.statusCode).toBe(503);
    expect(setup.json().error.code).toBe('speech_setup_required');
    expect(stub).not.toHaveBeenCalled();
  } finally {
    stub.mockRestore();
  }
});

it('reports STT and TTS separately and rejects a request over the configured total without dispatching', async () => {
  const stub = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected provider call.'));
  const limited = await buildServer({
    ...api, config: { ...api.config, SARVAM_API_KEY: 'synthetic-stub-key', SARVAM_TTS_MAX_CHARACTERS: 1 },
  });
  try {
    const capabilities = (await limited.inject({ method: 'GET', url: `${base}/capabilities`, headers: headers() })).json<SpeechCapabilities>();
    expect(capabilities.stt.status).toBe('configured');
    expect(capabilities.tts.status).toBe('configured');
    const reply = await limited.inject({ method: 'POST', url: `${base}/synthesize`, headers: headers(), payload: reviewed });
    expect(reply.statusCode).toBe(429);
    expect(reply.json().error.code).toBe('speech_budget_exhausted');
    expect(stub).not.toHaveBeenCalled();
  } finally {
    await limited.close();
    stub.mockRestore();
  }
});

it('reserves a bounded total with only the API function and rolls back test usage', async () => {
  const before = await db.owner(async (client) =>
    (await client.query<{ reserved_units: number }>("select reserved_units from sutra.speech_usage_budget where operation = 'stt'")).rows[0]?.reserved_units ?? 0,
  );
  await db.asActor(fixture.patientUserId, async (client) => {
    await client.query('savepoint speech_test');
    try {
      const reserve = async () => (await client.query<{ allowed: boolean }>(
        "select sutra.reserve_speech_usage('stt', 1, $1) as allowed", [Number(before) + 1],
      )).rows[0]?.allowed;
      expect(await reserve()).toBe(true);
      expect(await reserve()).toBe(false);
    } finally {
      await client.query('rollback to savepoint speech_test');
    }
  });
  await expect(db.asActor(fixture.patientUserId, (client) =>
    client.query('select * from sutra.speech_usage_budget'),
  )).rejects.toMatchObject({ code: '42501' });
});


it('zero removes the cumulative speech cap while retaining the usage ledger', async () => {
  await db.asActor(fixture.patientUserId, async client => {
    await client.query('savepoint unlimited_speech');
    try {
      const reserve = async () => (await client.query<{ allowed: boolean }>(
        "select sutra.reserve_speech_usage('tts', 500, 0) as allowed",
      )).rows[0]?.allowed;
      expect(await reserve()).toBe(true);
      expect(await reserve()).toBe(true);
    } finally { await client.query('rollback to savepoint unlimited_speech'); }
  });
  const stub = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Synthetic provider unavailable'));
  const unlimited = await buildServer({ ...api, config: { ...api.config, SARVAM_API_KEY: 'synthetic-stub-key' } });
  try {
    const capabilities = (await unlimited.inject({ method: 'GET', url: `${base}/capabilities`, headers: headers() })).json<SpeechCapabilities>();
    expect(capabilities.stt.status).toBe('configured');
    expect(capabilities.tts.status).toBe('configured');
    const reply = await unlimited.inject({ method: 'POST', url: `${base}/synthesize`, headers: headers(), payload: reviewed });
    expect(reply.statusCode).not.toBe(429);
    expect(stub).toHaveBeenCalledTimes(1);
  } finally { stub.mockRestore(); await unlimited.close(); }
});
