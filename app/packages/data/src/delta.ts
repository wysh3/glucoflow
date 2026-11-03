import type { DeltaAction, DeltaDisposition } from '@glucoflow/contracts';
import type { DbClient } from './pool';

/** Append-only delta decisions. The latest row per item is the current state. */

type DispositionRow = {
  item_id: string;
  action: string;
  note: string | null;
  actor_name: string;
  created_at: string;
};

function mapDisposition(row: DispositionRow): DeltaDisposition {
  return {
    action: row.action as DeltaAction,
    note: row.note,
    actorName: row.actor_name,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function listLatestDeltaDispositions(
  client: DbClient,
  patientId: string,
): Promise<Record<string, DeltaDisposition>> {
  const result = await client.query<DispositionRow>(
    `select distinct on (d.item_id)
            d.item_id, d.action, d.note, a.display_name as actor_name, d.created_at
       from sutra.delta_dispositions d
       join sutra.app_users a on a.id = d.actor_id
      where d.patient_id = $1
      order by d.item_id, d.created_at desc, d.id desc`,
    [patientId],
  );
  const dispositions: Record<string, DeltaDisposition> = {};
  for (const row of result.rows) dispositions[row.item_id] = mapDisposition(row);
  return dispositions;
}

export async function recordDeltaDisposition(
  client: DbClient,
  patientId: string,
  input: { itemId: string; action: DeltaAction; note?: string },
): Promise<DeltaDisposition> {
  const result = await client.query<DispositionRow>(
    `insert into sutra.delta_dispositions (patient_id, item_id, action, note)
     values ($1, $2, $3, $4)
     returning item_id, action, note, created_at,
       (select u.display_name from sutra.app_users u where u.id = delta_dispositions.actor_id) as actor_name`,
    [patientId, input.itemId, input.action, input.note ?? null],
  );
  return mapDisposition(result.rows[0]!);
}
