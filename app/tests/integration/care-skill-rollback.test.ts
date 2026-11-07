import { afterEach, expect, it, vi } from 'vitest';
import type { DbClient } from '@glucoflow/data/pool';
import { seedCareWorkspace } from '../../apps/api/src/care/seed';
import { createSkillArtifact } from '../../apps/api/src/care/skill-artifact';
import { actOnSkill } from '../../apps/api/src/care/skills';

vi.mock('../../apps/api/src/care/seed', async (original) => {
  const actual = await original<typeof import('../../apps/api/src/care/seed')>();
  return { ...actual, seedCareWorkspace: vi.fn(actual.seedCareWorkspace) };
});
afterEach(() => vi.mocked(seedCareWorkspace).mockClear());

function database() {
  const skill = {
    artifact: createSkillArtifact('specimen_receipt'), tested_artifact: null,
    id: 'old', pattern: 'specimen_receipt', version: 1, status: 'retired',
    origin_id: null, restored_from_id: null, captured_at: new Date(), created_at: new Date(),
    approved_at: new Date(), approved_by_name: 'Synthetic reviewer', test_results: [true, true, true, true, true],
  };
  const query = vi.fn(async (sql: string, values?: unknown[]) => {
    if (sql.includes('from sutra.care_workspaces')) return { rows: [{ clinic_id: 'clinic', can_review: true }] };
    if (sql.includes('max(version)')) return { rows: [{ version: 2 }] };
    if (sql.includes("s.status = 'approved'")) return { rows: [] };
    if (sql.includes('insert into sutra.care_skills')) return { rows: [{ id: 'restored' }] };
    if (sql.includes('select s.*')) return { rows: [{ ...skill, ...(values?.[1] === 'restored' ? { id: 'restored', version: 2, status: 'approved' } : {}) }] };
    return { rows: [] };
  });
  return { client: { query } as unknown as DbClient, query };
}

it('refuses rollback when the current sandbox fails despite historical passing results', async () => {
  const state = seedCareWorkspace(new Date());
  state.feeds.LIS.connected = false;
  vi.mocked(seedCareWorkspace).mockReturnValueOnce(state);
  const { client, query } = database();
  await expect(actOnSkill(client, 'workspace', 'reviewer', 'old', 'rollback'))
    .rejects.toMatchObject({ status: 409, code: 'skill_tests_required' });
  expect(query.mock.calls.some(([sql]) => /update sutra.care_skills|insert into sutra.care_skills/.test(sql))).toBe(false);
});

it('runs the current sandbox before restoring an approved version', async () => {
  const { client, query } = database();
  await expect(actOnSkill(client, 'workspace', 'reviewer', 'old', 'rollback'))
    .resolves.toMatchObject({ version: 2, status: 'approved' });
  expect(seedCareWorkspace).toHaveBeenCalledOnce();
  const inserted = query.mock.calls.find(([sql]) => sql.includes('insert into sutra.care_skills'));
  expect(inserted?.[1]?.[7]).toEqual([true, true, true, true, true]);
});

it('restores the exact stored semantic artifact, not a fresh default', async () => {
  const { client, query } = database();
  await actOnSkill(client, 'workspace', 'reviewer', 'old', 'rollback');
  const inserted = query.mock.calls.find(([sql]) => sql.includes('insert into sutra.care_skills'));
  expect(inserted?.[1]?.[8]).toEqual(createSkillArtifact('specimen_receipt'));
});
