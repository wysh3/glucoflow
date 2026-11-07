import type { CareWorkspace } from '@glucoflow/contracts';
import type { DbClient } from '@glucoflow/data/pool';
import { reconcileCareWorkspace } from '../../api/src/care/monitor';

/** A small, restart-safe batch. Row locks serialize against user commands; no model calls. */
export async function monitorCareBatch(client: DbClient, at = new Date().toISOString(), workspaceId: string | null = null): Promise<number> {
  const {rows} = await client.query<{state: CareWorkspace}>(`
    select state from sutra.care_workspaces
    where archived_at is null and ($2::uuid is null or id=$2) and monitor_checked_at < $1::timestamptz - interval '15 seconds'
      and state->'tasks' @? '$[*] ? (@.status == "awaiting_approval" || @.status == "monitoring" || @.status == "awaiting_evidence" || @.status == "paused")'
    order by monitor_checked_at, id limit 20 for update skip locked`, [at, workspaceId]);
  let changed = 0;
  for (const {state} of rows) {
    if (reconcileCareWorkspace(state, at)) {
      state.revision += 1;
      state.updatedAt = at;
      await client.query('update sutra.care_workspaces set state=$2::jsonb, monitor_checked_at=$3 where id=$1', [state.id, JSON.stringify(state), at]);
      changed += 1;
    } else {
      await client.query('update sutra.care_workspaces set monitor_checked_at=$2 where id=$1', [state.id, at]);
    }
  }
  return changed;
}
