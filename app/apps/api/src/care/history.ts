import type { CareWorkspace } from '@glucoflow/contracts';
import type { DbClient } from '@glucoflow/data/pool';
import { ApiError } from '../errors';

const pageSize = 30;
function parseCursor(cursor: string): string {
  if (!/^[1-9]\d{0,18}$/.test(cursor) || BigInt(cursor) > 9223372036854775807n) {
    throw ApiError.validation('That history cursor is invalid.');
  }
  return cursor;
}
async function assertVisible(client: DbClient, id: string): Promise<void> {
  const visible = await client.query('select id from sutra.care_workspaces where id=$1', [id]);
  if (!visible.rowCount) throw ApiError.notFound('That workspace history is not available.');
}
/** Summaries are paginated separately from snapshots to bound response size. */
export async function listWorkspaceHistory(client: DbClient, id: string, cursor?: string) {
  const before = cursor === undefined ? null : parseCursor(cursor);
  await assertVisible(client, id);
  const { rows } = await client.query<{
    id: string; revision: number; recordedAt: string; baseline: boolean;
    origin: 'staff'|'worker'|'baseline';
  }>(`select id::text,revision,recorded_at as "recordedAt",baseline,
       case when baseline then 'baseline' when worker_id is not null then 'worker' else 'staff' end as origin
       from sutra.care_workspace_history h
       where workspace_id=$1 and ($2::bigint is null or id<$2::bigint)
       order by h.id desc limit $3`, [id, before, pageSize+1]);
  const revisions = rows.slice(0,pageSize);
  return { revisions, nextCursor: rows.length > pageSize ? revisions.at(-1)!.id : null };
}
export async function readWorkspaceHistory(client: DbClient, id: string, historyId: string) {
  parseCursor(historyId);
  await assertVisible(client,id);
  const { rows } = await client.query<{id:string; revision:number; recordedAt:string; baseline:boolean; state:CareWorkspace}>(
    `select id::text,revision,recorded_at as "recordedAt",baseline,state
     from sutra.care_workspace_history where workspace_id=$1 and id=$2::bigint`, [id,historyId]);
  if (!rows[0]) throw ApiError.notFound('That workspace revision is not available.');
  return rows[0];
}
