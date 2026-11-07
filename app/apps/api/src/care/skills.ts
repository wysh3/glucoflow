import type {
  CareApplicableSkill, CareCommand, CareEvent, CareSkill, CareSkillAction, CareSkillList,
  CareSkillPattern, CareSkillPreview, CareSkillStatus, CareWorkspace,
} from '@glucoflow/contracts';
import type { DbClient } from '@glucoflow/data/pool';
import { ApiError } from '../errors';
import { createCareTask, hasCoveredTask } from './commands';
import { feedIsFresh, latestAcknowledgement, latestEvent, latestMatchingSpecimenReceipt, logActivity, orderEvents, recordSourceEvent } from './events';
import { seedCareWorkspace } from './seed';
import { createSkillArtifact, validateSkillArtifact, type SkillArtifact } from './skill-artifact';

const patterns = {
  specimen_receipt: {
    title: 'Verify specimen receipt',
    description: 'After a matching HIS collection, propose tracking receipt in the LIS.',
    source: 'LIS', kind: 'specimen_received', durationMinutes: 30,
    stopConditions: ['LIS records the matching specimen receipt', 'HIS cancels the order', 'The monitoring window ends'],
  },
  result_acknowledgement: {
    title: 'Verify result acknowledgement',
    description: 'After matching LIS validation or correction, propose tracking acknowledgement in the HIS.',
    source: 'HIS', kind: 'result_acknowledged', durationMinutes: 30,
    stopConditions: ['HIS acknowledges the current result version', 'HIS cancels the order', 'The monitoring window ends'],
  },
} as const;

const cases = [
  { name: 'Matching operational stage', detail: 'The correct pending stage produces a proposal linked to the target source event.' },
  { name: 'Wrong operational stage', detail: 'An order without the required source event is ineligible.' },
  { name: 'Mismatched encounter and order', detail: 'Evidence from a different encounter cannot be used.' },
  { name: 'Unavailable source', detail: 'The proposal is blocked when a required feed is disconnected or stale.' },
  { name: 'Cancelled order', detail: 'A recorded cancellation takes precedence over earlier evidence.' },
];

interface SkillRow {
  id: string;
  pattern: CareSkillPattern;
  version: number;
  status: CareSkillStatus;
  origin_id: string | null;
  restored_from_id: string | null;
  captured_at: Date;
  created_at: Date;
  created_by: string | null;
  approved_at: Date | null;
  approved_by_name: string | null;
  test_results: boolean[];
  artifact: SkillArtifact;
  tested_artifact: SkillArtifact | null;
  workspace_id: string | null;
  encounter_id: string | null;
  task_id: string | null;
  event_id: string | null;
}

interface SkillScope {
  clinic_id: string;
  can_review: boolean;
}

async function scopeFor(client: DbClient, workspaceId: string): Promise<SkillScope> {
  const { rows } = await client.query<SkillScope>(
    `select clinic_id, sutra.is_clinic_member(clinic_id, 'clinician') as can_review
       from sutra.care_workspaces where id = $1`,
    [workspaceId],
  );
  if (!rows[0]) throw ApiError.notFound('That simulation workspace is not available.');
  return rows[0];
}

const skillSelect = `
  select s.*, o.workspace_id, o.encounter_id, o.task_id, o.event_id,
         u.display_name as approved_by_name
    from sutra.care_skills s
    left join sutra.care_skill_origins o on o.id = s.origin_id
    left join sutra.app_users u on u.id = s.approved_by
   where s.clinic_id = $1`;

async function skillFor(client: DbClient, clinicId: string, id: string): Promise<SkillRow> {
  const { rows } = await client.query<SkillRow>(`${skillSelect} and s.id = $2`, [clinicId, id]);
  if (!rows[0]) throw ApiError.notFound('That operational skill is not available.');
  return rows[0];
}

function skillDto(row: SkillRow, scope: SkillScope, userId: string): CareSkill {
  const config = patterns[row.pattern];
  const origin = row.workspace_id && row.task_id && row.event_id
    ? { workspaceId: row.workspace_id, taskId: row.task_id, eventId: row.event_id }
    : null;
  return {
    id: row.id, pattern: row.pattern, version: row.version, status: row.status,
    title: config.title, description: config.description,
    permittedAction: 'Create a proposed monitoring task that requires human approval.',
    stopConditions: [...config.stopConditions],
    createdAt: row.created_at.toISOString(), approvedAt: row.approved_at?.toISOString() ?? null,
    approvedBy: row.approved_by_name,
    canTest: row.status === 'draft' && (scope.can_review || row.created_by === userId),
    tests: row.test_results.map((passed, index) => ({ ...cases[index]!, passed })),
    provenance: { source: config.source, kind: config.kind, capturedAt: row.captured_at.toISOString() },
    origin,
  };
}

export async function listSkills(client: DbClient, workspaceId: string, userId: string): Promise<CareSkillList> {
  const scope = await scopeFor(client, workspaceId);
  const { rows } = await client.query<SkillRow>(`${skillSelect} order by s.created_at desc, s.id desc`, [scope.clinic_id]);
  return { skills: rows.map((row) => skillDto(row, scope, userId)), canReview: scope.can_review };
}

/** Serialize versions and publication within one clinic/pattern. Workspace locks always come first. */
async function lockPattern(client: DbClient, clinicId: string, pattern: CareSkillPattern): Promise<void> {
  await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`care-skill:${clinicId}:${pattern}`]);
}

async function nextVersion(client: DbClient, clinicId: string, pattern: CareSkillPattern): Promise<number> {
  const { rows } = await client.query<{ version: number }>(
    'select coalesce(max(version), 0) + 1 as version from sutra.care_skills where clinic_id = $1 and pattern = $2',
    [clinicId, pattern],
  );
  const version = rows[0]!.version;
  if (version > 200) throw ApiError.conflict('This clinic reached the version limit for this operational pattern.');
  return version;
}

export async function captureSkill(client: DbClient, state: CareWorkspace, userId: string, taskId: string): Promise<CareSkill> {
  const scope = await scopeFor(client, state.id);
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw ApiError.notFound('That task is not in this simulation.');
  if (task.status !== 'source_confirmed' || task.kind === 'handover' || !task.orderId) {
    throw ApiError.conflict('Capture requires a source-confirmed specimen receipt or result acknowledgement.', 'skill_outcome_required');
  }
  const events = orderEvents(state, task.encounterId, task.orderId);
  const evidence = task.kind === 'specimen_receipt' ? latestMatchingSpecimenReceipt(events) : latestAcknowledgement(events);
  if (!evidence || evidence.id !== task.completionEventId || latestEvent(events, 'order_cancelled')) {
    throw ApiError.conflict('The task has no matching current source completion.', 'skill_outcome_required');
  }
  await lockPattern(client, scope.clinic_id, task.kind);

  const existing = await client.query<SkillRow>(
    `${skillSelect} and o.workspace_id = $2 and o.task_id = $3 and o.event_id = $4 order by s.version limit 1`,
    [scope.clinic_id, state.id, task.id, evidence.id],
  );
  if (existing.rows[0]) return skillDto(existing.rows[0], scope, userId);

  const version = await nextVersion(client, scope.clinic_id, task.kind);
  const origin = await client.query<{ id: string }>(
    `insert into sutra.care_skill_origins (workspace_id, encounter_id, task_id, event_id)
     values ($1, $2, $3, $4) returning id`,
    [state.id, task.encounterId, task.id, evidence.id],
  );
  const inserted = await client.query<{ id: string }>(
    `insert into sutra.care_skills (clinic_id, pattern, version, status, origin_id, captured_at, created_by, artifact)
     values ($1, $2, $3, 'draft', $4, now(), $5, $6) returning id`,
    [scope.clinic_id, task.kind, version, origin.rows[0]!.id, userId, createSkillArtifact(task.kind)],
  );
  return skillDto(await skillFor(client, scope.clinic_id, inserted.rows[0]!.id), scope, userId);
}

function ineligible(reason: string): CareSkillPreview {
  return { eligible: false, reason, sourceEventId: null, task: null };
}

function previewPattern(
  state: CareWorkspace, pattern: CareSkillPattern, encounterId: string, orderId: string, now: number, artifact: SkillArtifact,
): CareSkillPreview {
  validateSkillArtifact(artifact, pattern);
  if (!state.orders.some((order) => order.id === orderId && order.encounterId === encounterId) ||
      !state.encounters.some((encounter) => encounter.id === encounterId)) {
    return ineligible('Choose an order that belongs to the current encounter.');
  }
  if (!feedIsFresh(state, 'HIS', now) || !feedIsFresh(state, 'LIS', now)) {
    return ineligible('HIS and LIS must both be connected and fresh.');
  }
  const events = orderEvents(state, encounterId, orderId);
  if (latestEvent(events, 'order_cancelled')) return ineligible('The HIS cancelled this order.');

  let evidence: CareEvent | undefined;
  if (pattern === 'specimen_receipt') {
    if (latestMatchingSpecimenReceipt(events)) return ineligible('The LIS already recorded matching specimen receipt.');
    if (latestEvent(events, 'specimen_received')) return ineligible('Review the unverified receipt chronology before applying this routine.');
    evidence = latestEvent(events, 'specimen_collected');
    if (!evidence) return ineligible('A matching HIS specimen collection is required.');
  } else {
    if (latestAcknowledgement(events)) return ineligible('The HIS already acknowledged the current result version.');
    evidence = latestEvent(events, 'result_validated', 'result_corrected');
    if (!evidence) return ineligible('Matching LIS result validation or correction is required.');
  }
  if (hasCoveredTask(state, encounterId, orderId, pattern)) {
    return ineligible('A monitoring task already covers this order and stage.');
  }

  const config = patterns[pattern];
  return {
    eligible: true, reason: 'Matched evidence from this encounter and order while both feeds are fresh. Human approval is required.',
    sourceEventId: evidence.id, task: { kind: pattern, title: config.title, durationMinutes: artifact.durationMinutes },
  };
}

function previewSkillRow(state: CareWorkspace, row: SkillRow, encounterId: string, orderId: string, now: number): CareSkillPreview {
  if (row.status !== 'approved') return ineligible('This skill version is not currently approved.');
  if (!row.tested_artifact) return ineligible('This legacy skill needs revalidation. Retire and restore it to run the current sandbox.');
  validateSkillArtifact(row.tested_artifact, row.pattern);
  if (row.encounter_id === encounterId) return ineligible('Choose an encounter other than the one this skill came from.');
  return previewPattern(state, row.pattern, encounterId, orderId, now, row.artifact);
}

export async function previewSkill(
  client: DbClient, state: CareWorkspace, skillId: string, encounterId: string, orderId: string,
): Promise<CareSkillPreview> {
  const scope = await scopeFor(client, state.id);
  const row = await skillFor(client, scope.clinic_id, skillId);
  return previewSkillRow(state, row, encounterId, orderId, Date.now());
}

export async function applicableSkillsForWorkspace(client: DbClient, state: CareWorkspace): Promise<CareApplicableSkill[]> {
  const scope = await scopeFor(client, state.id);
  const { rows } = await client.query<SkillRow>(`${skillSelect} and s.status = 'approved'`, [scope.clinic_id]);
  const now = Date.now();
  return rows.flatMap((row) => state.orders.flatMap(({ id: orderId, encounterId }) =>
    previewSkillRow(state, row, encounterId, orderId, now).eligible
      ? [{ id: row.id, version: row.version, pattern: row.pattern, title: patterns[row.pattern].title, encounterId, orderId }]
      : [],
  ));
}

export async function applySkillProposal(
  client: DbClient, state: CareWorkspace, command: Extract<CareCommand, { type: 'apply_skill' }>, at: string,
): Promise<boolean> {
  const scope = await scopeFor(client, state.id);
  const before = await skillFor(client, scope.clinic_id, command.skillId);
  await lockPattern(client, scope.clinic_id, before.pattern);
  const skill = await skillFor(client, scope.clinic_id, command.skillId);
  const preview = previewSkillRow(state, skill, command.encounterId, command.orderId, Date.now());
  if (!preview.eligible || !preview.task || !preview.sourceEventId) {
    throw ApiError.conflict(preview.reason, 'skill_not_applicable');
  }
  const task = createCareTask(state, {
    type: 'create_task', encounterId: command.encounterId, orderId: command.orderId, ...preview.task,
  }, at);
  task.skillId = skill.id;
  task.skillVersion = skill.version;
  task.skillSourceEventId = preview.sourceEventId;
  logActivity(state, at, 'skill_proposed', 'Operational skill proposed', `${task.title} · Skill v${skill.version} · Human approval required`, task.id);
  return true;
}

function runCases(pattern: CareSkillPattern, artifact: SkillArtifact): boolean[] {
  validateSkillArtifact(artifact, pattern);
  const now = new Date();
  const state = seedCareWorkspace(now);
  state.tasks = [];
  const order = state.orders[pattern === 'specimen_receipt' ? 1 : 2]!;
  const wrongStage = state.orders[0]!;
  const evaluate = () => previewPattern(state, pattern, order.encounterId, order.id, now.getTime(), artifact);
  const expectedEvidence = state.events.find((event) =>
    event.orderId === order.id && event.kind === (pattern === 'specimen_receipt' ? 'specimen_collected' : 'result_validated'));
  const positive = evaluate();
  const invalidStage = previewPattern(state, pattern, wrongStage.encounterId, wrongStage.id, now.getTime(), artifact);
  const mismatch = previewPattern(state, pattern, wrongStage.encounterId, order.id, now.getTime(), artifact);
  state.feeds.LIS.connected = false;
  const unavailable = evaluate();
  state.feeds.LIS.connected = true;
  recordSourceEvent(state, {
    type: 'source_event', encounterId: order.encounterId, orderId: order.id,
    kind: 'order_cancelled', source: 'HIS', sourceRef: 'HIS-SKILL-SANDBOX-CANCEL',
  }, now.toISOString());
  const cancelled = evaluate();
  return [
    positive.eligible && Boolean(expectedEvidence) && positive.sourceEventId === expectedEvidence?.id && positive.task?.kind === pattern,
    !invalidStage.eligible, !mismatch.eligible, !unavailable.eligible, !cancelled.eligible,
  ];
}

async function supersedeActive(client: DbClient, clinicId: string, pattern: CareSkillPattern): Promise<void> {
  await client.query(
    "update sutra.care_skills set status = 'superseded' where clinic_id = $1 and pattern = $2 and status = 'approved'",
    [clinicId, pattern],
  );
}

export async function actOnSkill(
  client: DbClient, workspaceId: string, userId: string, skillId: string, action: CareSkillAction,
): Promise<CareSkill> {
  const scope = await scopeFor(client, workspaceId);
  const before = await skillFor(client, scope.clinic_id, skillId);
  await lockPattern(client, scope.clinic_id, before.pattern);
  const skill = await skillFor(client, scope.clinic_id, skillId);
  if (action !== 'test' && !scope.can_review) {
    throw ApiError.forbidden('An active clinic clinician membership is required to review operational skills.');
  }

  switch (action) {
    case 'test':
      if (!scope.can_review && skill.created_by !== userId) throw ApiError.forbidden('Only the draft author or a clinic clinician can test this skill.');
      if (skill.status !== 'draft') throw ApiError.conflict('Only draft skills can be tested.');
      await client.query('update sutra.care_skills set test_results = $2, tested_artifact = artifact where id = $1', [skillId, runCases(skill.pattern, skill.artifact)]);
      break;
    case 'approve': {
      if (skill.status === 'approved') break;
      if (skill.status !== 'draft' || skill.test_results.length !== cases.length || !skill.test_results.every(Boolean)) {
        throw ApiError.conflict('Only a draft with passing sandbox tests can be approved.', 'skill_tests_required');
      }
      validateSkillArtifact(skill.artifact, skill.pattern);
      validateSkillArtifact(skill.tested_artifact, skill.pattern);
      // Approval re-evaluates current guards rather than trusting stored booleans alone.
      if (!runCases(skill.pattern, skill.artifact).every(Boolean)) {
        throw ApiError.conflict('The skill must pass the current sandbox before approval.', 'skill_tests_required');
      }
      const newer = await client.query(
        'select 1 from sutra.care_skills where clinic_id = $1 and pattern = $2 and version > $3 and approved_at is not null',
        [scope.clinic_id, skill.pattern, skill.version],
      );
      if (newer.rowCount) throw ApiError.conflict('A newer skill version has already been approved.');
      await supersedeActive(client, scope.clinic_id, skill.pattern);
      await client.query(
        "update sutra.care_skills set status = 'approved', approved_at = now(), approved_by = $2 where id = $1",
        [skillId, userId],
      );
      break;
    }
    case 'reject':
      if (skill.status === 'rejected') break;
      if (skill.status !== 'draft') throw ApiError.conflict('Only draft skills can be rejected.');
      await client.query("update sutra.care_skills set status = 'rejected' where id = $1", [skillId]);
      break;
    case 'retire':
      if (skill.status === 'retired') break;
      if (skill.status !== 'approved') throw ApiError.conflict('Only the approved skill version can be retired.');
      await client.query("update sutra.care_skills set status = 'retired' where id = $1", [skillId]);
      break;
    case 'rollback': {
      if (skill.status !== 'retired' && skill.status !== 'superseded') {
        throw ApiError.conflict('Choose a retired or superseded version to restore.');
      }
      const active = await client.query<SkillRow>(
        `${skillSelect} and s.pattern = $2 and s.status = 'approved'`, [scope.clinic_id, skill.pattern],
      );
      if (active.rows[0]?.restored_from_id === skill.id) return skillDto(active.rows[0], scope, userId);
      // Restore the exact immutable artifact, evaluated against current safety guards.
      // Unsupported engine revisions fail closed rather than silently changing semantics.
      const testResults = runCases(skill.pattern, skill.artifact);
      if (testResults.length !== cases.length || !testResults.every(Boolean)) {
        throw ApiError.conflict('The restored pattern must pass the current sandbox tests.', 'skill_tests_required');
      }
      const version = await nextVersion(client, scope.clinic_id, skill.pattern);
      await supersedeActive(client, scope.clinic_id, skill.pattern);
      const inserted = await client.query<{ id: string }>(
        `insert into sutra.care_skills
           (clinic_id, pattern, version, status, origin_id, restored_from_id, captured_at, created_by,
            approved_at, approved_by, test_results, artifact, tested_artifact)
         values ($1, $2, $3, 'approved', $4, $5, $6, $7, now(), $7, $8, $9, $9) returning id`,
        [scope.clinic_id, skill.pattern, version, skill.origin_id, skill.id, skill.captured_at, userId, testResults, skill.artifact],
      );
      return skillDto(await skillFor(client, scope.clinic_id, inserted.rows[0]!.id), scope, userId);
    }
  }
  return skillDto(await skillFor(client, scope.clinic_id, skillId), scope, userId);
}
