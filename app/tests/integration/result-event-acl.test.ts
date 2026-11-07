import { expect, it } from 'vitest';
import { createTestContext } from './harness';
it('does not expose the internal result audit writer to API or worker callers', async () => {
  const context = await createTestContext();
  try {
    const signature = 'sutra.result_event(uuid,uuid,text,text,text,text,jsonb,text,text)';
    const result = await context.ownerPool.query('select has_function_privilege($1, $3, \'execute\') as api, has_function_privilege($2, $3, \'execute\') as worker', [context.apiRole, context.workerRole, signature]);
    expect(result.rows[0]).toEqual({ api: false, worker: false });
  } finally { await context.close(); }
});
