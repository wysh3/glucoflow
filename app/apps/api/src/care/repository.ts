import { createHash, randomUUID } from 'node:crypto';
import type { CareChatResult, CareCommand, CareWorkspace, CareWorkspaceList, CareWorkspaceSummary } from '@glucoflow/contracts';
import type { DbClient } from '@glucoflow/data/pool';
import { z } from 'zod';
import { ApiError } from '../errors';
import { executeCareCommand } from './commands';
import { limits } from './events';
import { reconcileCareWorkspace } from './monitor';
import { seedCareWorkspace } from './seed';
import { applySkillProposal } from './skills';
import { resolveCareAccess, auditTeamCommand } from './team';

const recoveryPageSize = 30;
const recoveryCursor = z.tuple([z.iso.datetime(), z.uuid()]);

export async function listWorkspaces(client: DbClient, ownerId: string, cursor?: string): Promise<CareWorkspaceList> {
  const parsed = cursor ? recoveryCursor.safeParse(cursor.split('~')) : undefined;
  if (parsed && !parsed.success) throw ApiError.validation('That workspace recovery cursor is invalid.');
  const [updatedAt, id] = parsed?.data ?? [null, null];
  const { rows } = await client.query<CareWorkspaceSummary>(
    `select w.id, state->>'name' as name, coalesce(tm.role, state->>'role') as role,
            state->>'createdAt' as "createdAt", state->>'updatedAt' as "updatedAt", true as synthetic
       from sutra.care_workspaces w
       left join sutra.care_workspace_team_members tm on tm.workspace_id=w.id and tm.user_id=$1 and tm.active
      where ($2::text is null or (state->>'updatedAt', w.id) < ($2, $3::uuid))
      order by state->>'updatedAt' desc, w.id desc
      limit $4`,
    [ownerId, updatedAt, id, recoveryPageSize + 1],
  );
  const workspaces = rows.slice(0, recoveryPageSize);
  const last = workspaces.at(-1);
  return { workspaces, nextCursor: rows.length > recoveryPageSize && last ? `${last.updatedAt}~${last.id}` : null };
}

export async function createWorkspace(client: DbClient, ownerId: string, clinicId: string): Promise<CareWorkspace> {
  const state = seedCareWorkspace(new Date());
  await client.query(
    'insert into sutra.care_workspaces (id, owner_id, clinic_id, state) values ($1, $2, $3, $4::jsonb)',
    [state.id, ownerId, clinicId, JSON.stringify(state)],
  );
  return state;
}

async function lockWorkspace(client: DbClient, id: string, actorId: string) {
  const { rows } = await client.query<{ state: CareWorkspace; archivedAt: string | null; previousWorkspaceId: string | null }>(
    'select state, archived_at::text as "archivedAt", previous_workspace_id as "previousWorkspaceId" from sutra.care_workspaces where id = $1 for update', [id],
  );
  const state = rows[0]?.state;
  if (!state) throw ApiError.notFound('That simulation workspace is not available.');
  const access = await resolveCareAccess(client, id, actorId);
  return { state, access, archivedAt: rows[0]!.archivedAt, previousWorkspaceId: rows[0]!.previousWorkspaceId };
}

function projectRole(state: CareWorkspace, role: CareWorkspace['role'] | null): CareWorkspace {
  return role ? { ...state, role } : state;
}

async function saveWorkspace(client: DbClient, state: CareWorkspace, at: string): Promise<void> {
  state.updatedAt = at;
  state.revision += 1;
  await client.query('update sutra.care_workspaces set state = $2::jsonb where id = $1', [state.id, JSON.stringify(state)]);
}

function assertMutationRoom(state: CareWorkspace): void {
  if (state.activity.length > limits.activity || Buffer.byteLength(JSON.stringify(state), 'utf8') > limits.stateBytes) {
    throw ApiError.conflict('This workspace has reached its history limit. Start a new simulation to continue.', 'workspace_limit');
  }
}

export async function readWorkspace(client: DbClient, id: string, ownerId: string): Promise<CareWorkspace> {
  const { state, access, archivedAt, previousWorkspaceId } = await lockWorkspace(client, id, ownerId);
  const at = new Date().toISOString();
  if (!archivedAt && reconcileCareWorkspace(state, at)) await saveWorkspace(client, state, at);
  return { ...projectRole(state, access.role), ...(archivedAt ? { archivedAt } : {}), ...(previousWorkspaceId ? { previousWorkspaceId } : {}) };
}

function staleRevision() {
  return ApiError.conflict('This simulation changed. Reload the workspace and try again.', 'stale_revision');
}

export async function applyCommand(
  client: DbClient, id: string, ownerId: string, key: string,
  input: { expectedRevision: number; command: CareCommand },
): Promise<CareWorkspace> {
  const { state, access, archivedAt } = await lockWorkspace(client, id, ownerId);
  if (archivedAt) throw ApiError.conflict('This workspace is archived and read-only. Open its continuation.', 'workspace_archived');
  const at = new Date().toISOString();
  if (access.shared && input.command.type === 'set_role') {
    throw ApiError.forbidden('Your role in this shared workspace is assigned by its owner.');
  }
  const hash = createHash('sha256').update(JSON.stringify(access.shared ? { actorId: ownerId, ...input } : input)).digest('hex');
  const { rows } = await client.query<{ request_hash: string }>(
    'select request_hash from sutra.care_command_receipts where workspace_id = $1 and key = $2', [id, key],
  );
  const receipt = rows[0];
  if (receipt) {
    if (receipt.request_hash !== hash) {
      throw ApiError.conflict('This Idempotency-Key was already used with a different request.', 'idempotency_conflict');
    }
    if (reconcileCareWorkspace(state, at)) await saveWorkspace(client, state, at);
    return projectRole(state, access.role);
  }
  if (state.revision !== input.expectedRevision) throw staleRevision();

  if (access.shared && input.command.type === 'coordination' && input.command.action === 'register_staff') {
    const command=input.command;
    if(!command.userId) throw ApiError.validation('Choose an authenticated member of this shared workspace.');
    const {rows:members}=await client.query<{role:string}>(
      'select role from sutra.care_workspace_team_members where workspace_id=$1 and user_id=$2 and active',
      [id,command.userId]);
    if(members[0]?.role!==command.role) throw ApiError.forbidden('The roster role must match an active workspace member.');
  }
  const before = reconcileCareWorkspace(state, at);
  const persistedRole = state.role;
  if (access.role) state.role = access.role;
  let applied: boolean;
  try {
    applied = input.command.type === 'apply_skill'
      ? await applySkillProposal(client, state, input.command, at)
      : executeCareCommand(state, input.command, at, {shared:access.shared,actorId:ownerId});
  } finally {
    if (access.shared) state.role = persistedRole;
  }
  const after = reconcileCareWorkspace(state, at);
  assertMutationRoom(state);
  if (before || applied || after) await saveWorkspace(client, state, at);

  const recorded = await client.query(
    `insert into sutra.care_command_receipts (workspace_id, key, request_hash, revision)
      select $1, $2, $3, $4
      where (select count(*) from sutra.care_command_receipts where workspace_id = $1) < $5`,
    [id, key, hash, state.revision, limits.commandReceipts],
  );
  if (!recorded.rowCount) {
    throw ApiError.conflict('This workspace has reached its command limit. Start a new simulation to continue.', 'workspace_limit');
  }
  if (access.shared) await auditTeamCommand(client, id, input.command.type, state.revision);
  return projectRole(state, access.role);
}

export function assertChatRoom(state: CareWorkspace): void {
  if (state.archivedAt) throw ApiError.conflict('This workspace is archived and read-only. Open its continuation.', 'workspace_archived');
  if (state.messages.length + 2 > limits.messages) {
    throw ApiError.conflict('This workspace has reached its message limit. Start a new simulation to continue.', 'workspace_limit');
  }
  assertMutationRoom(state);
}

export async function appendChat(
  client: DbClient, id: string, ownerId: string, expectedRevision: number, message: string, result: CareChatResult,
): Promise<CareWorkspace> {
  const { state, access, archivedAt } = await lockWorkspace(client, id, ownerId);
  if (archivedAt) throw ApiError.conflict('This workspace is archived and read-only. Open its continuation.', 'workspace_archived');
  const at = new Date().toISOString();
  if (state.revision !== expectedRevision || reconcileCareWorkspace(state, at)) throw staleRevision();
  assertChatRoom(state);
  state.messages.push(
    { id: randomUUID(), role: 'user', content: message, at },
    {
      id: randomUUID(), role: 'assistant', content: result.reply, at,
      engine: result.engine, languageCode: result.languageCode, sources: result.sources, proposals: result.proposals,
    },
  );
  assertMutationRoom(state);
  await saveWorkspace(client, state, at);
  if (access.shared) await auditTeamCommand(client, id, 'chat', state.revision);
  return projectRole(state, access.role);
}

/** Starts a separate seeded synthetic episode after all existing work is settled. */
export async function continueWorkspace(client: DbClient, id: string, actorId: string, expectedRevision: number) {
  const { access } = await lockWorkspace(client,id,actorId);
  if (access.ownerId !== actorId) throw ApiError.forbidden('Only the workspace owner can continue this demo.');
  const seed = seedCareWorkspace(new Date());
  const { rows } = await client.query<{id:string}>(
    'select sutra.continue_care_workspace($1,$2,$3::jsonb) as id',[id,expectedRevision,JSON.stringify(seed)]);
  const workspace = await readWorkspace(client,rows[0]!.id,actorId);
  return { workspace, previousWorkspaceId:id };
}
