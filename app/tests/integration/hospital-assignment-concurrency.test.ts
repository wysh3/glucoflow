import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { createTestContext } from './harness';
import { createAppContext } from '../../apps/api/src/context';
import { buildServer } from '../../apps/api/src/server';
import { signLocalToken } from '../../apps/api/src/auth';

it('rejects stale administrator writes without restoring revoked hospital access', async () => {
  const db = await createTestContext();
  const ctx = await createAppContext();
  const app = await buildServer(ctx);
  const admin = randomUUID(), staff = randomUUID(), clinic = randomUUID();
  const original = { administrator: false, careRole: 'nurse', active: true };
  try {
    await db.owner(async client => {
      for (const id of [admin, staff]) await client.query('insert into sutra.app_users(id,email,display_name) values($1,$2,$3)', [id, `${id}@example.invalid`, 'Synthetic concurrency staff']);
      await client.query('insert into sutra.clinics(id,display_name,hospital_managed) values($1,$2,true)', [clinic, 'Synthetic concurrency hospital']);
      await client.query("insert into sutra.memberships(clinic_id,user_id,administrator,care_role,active) values($1,$2,true,null,true),($1,$3,false,'nurse',true)", [clinic, admin, staff]);
    });
    const token = (await signLocalToken(ctx.config, { userId: admin, email: `${admin}@example.invalid` })).accessToken;
    const update = (body: object) => app.inject({method:'PATCH',url:`/api/v1/hospitals/${clinic}/staff/${staff}`,headers:{authorization:`Bearer ${token}`},payload:body});
    const revoked = await update({ ...original, active: false, expectedAssignment: original });
    expect(revoked.statusCode).toBe(200);
    const stale = await update({ ...original, careRole: 'lab', expectedAssignment: original });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.code).toBe('stale_revision');
    const stored = await db.owner(async client => (await client.query('select active,care_role from sutra.memberships where clinic_id=$1 and user_id=$2', [clinic,staff])).rows[0]);
    expect(stored).toEqual({active:false, care_role:'nurse'});
    const fresh = await update({ ...original, careRole: 'lab', expectedAssignment: { ...original, active:false } });
    expect(fresh.statusCode).toBe(200);
  } finally {
    await app.close(); await ctx.pool.end();
    await db.owner(async client => { await client.query('delete from sutra.clinics where id=$1',[clinic]); await client.query('delete from sutra.app_users where id=any($1::uuid[])',[[admin,staff]]); });
    await db.close();
  }
});
