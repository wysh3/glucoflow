import { parseArgs } from 'node:util';
import pg from 'pg';
import { loadEnvFileIntoProcess } from './lib/env';

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    args: process.argv.slice(2).filter((argument, index) => argument !== '--' || index !== 0),
    allowPositionals: true,
    options: {
      clinic: { type: 'string' },
      user: { type: 'string' },
      workspace: { type: 'string' },
      reference: { type: 'string' },
      name: { type: 'string' },
      'display-name': { type: 'string' },
      clinician: { type: 'boolean', default: false },
      confirm: { type: 'boolean', default: false },
    },
  });
  const action = positionals[0];
  const clinicId = values.clinic;
  const userId = values.user;
  const name = values.name?.trim();
  const displayName = values['display-name']?.trim();
  const workspaceId = values.workspace;
  const reference = values.reference?.trim();
  if (
    positionals.length !== 1 || !values.confirm || !clinicId || !uuid.test(clinicId) || !userId || !uuid.test(userId)
    || (action !== 'create' && action !== 'provision' && action !== 'recover')
    || (action === 'create' ? (!name || name.length > 120) : values.name !== undefined)
    || (action !== 'provision' && values.clinician)
    || (action === 'recover'
      ? (!workspaceId || !uuid.test(workspaceId) || !reference || reference.length > 100 || displayName !== undefined)
      : workspaceId !== undefined || reference !== undefined)
    || (displayName !== undefined && (!displayName || displayName.length > 120))
  ) {
    throw new Error('Use create, provision, or recover with --clinic UUID --user UUID --confirm. Create also needs --name; recover needs --workspace UUID and --reference.');
  }

  loadEnvFileIntoProcess();
  const ownerUrl = process.env.DATABASE_URL_OWNER;
  const authMode = process.env.AUTH_MODE;
  if (!ownerUrl || (authMode !== 'supabase' && authMode !== 'local')) {
    throw new Error('Configure DATABASE_URL_OWNER and set AUTH_MODE to supabase or local.');
  }
  if (authMode === 'local' && process.env.APP_ENV !== 'development' && process.env.APP_ENV !== 'test') {
    throw new Error('Local identities require APP_ENV=development or APP_ENV=test.');
  }

  const client = new pg.Client({ connectionString: ownerUrl, statement_timeout: 15_000 });
  await client.connect();
  try {
    await client.query('begin');
    if (authMode === 'supabase') {
      const identity = await client.query<{ email: string }>(
        `select email from auth.users where id=$1 and email_confirmed_at is not null
          and email is not null and (banned_until is null or banned_until<=now()) and deleted_at is null
          for share`,
        [userId],
      );
      const email = identity.rows[0]?.email;
      if (!email) throw new Error('A confirmed, active Supabase Auth identity is required.');
      const profile = await client.query<{ email: string }>(
        'select email from sutra.app_users where id=$1 for update', [userId],
      );
      if (!profile.rowCount) {
        if (!displayName) throw new Error('Supply --display-name to create the application profile for this verified identity.');
        await client.query('insert into sutra.app_users(id,email,display_name) values($1,$2,$3)', [userId, email, displayName]);
      } else if (profile.rows[0]!.email.toLowerCase() !== email.toLowerCase()) {
        throw new Error('The verified identity and existing application profile need matching email addresses.');
      }
    } else {
      const identity = await client.query('select 1 from sutra.local_credentials where user_id=$1', [userId]);
      if (!identity.rowCount) throw new Error('Use an existing local test identity.');
    }

    if (action === 'recover') {
      await client.query('select sutra.recover_hospital_workspace($1,$2,$3,$4)', [clinicId, workspaceId, userId, reference]);
      await client.query('commit');
      console.log('Managed workspace ownership recovered. Existing staff access and care state were preserved.');
      return;
    }

    if (action === 'create') {
      // Bootstrap only a new isolated clinic. Existing demo data is never converted.
      await client.query(
        'insert into sutra.clinics(id,display_name,hospital_managed) values($1,$2,true)', [clinicId, name],
      );
    }
    const hospital = await client.query(
      'select 1 from sutra.clinics where id=$1 and hospital_managed for no key update', [clinicId],
    );
    if (!hospital.rowCount) throw new Error('The managed hospital does not exist.');
    const bootstrap = action === 'create';
    const membership = await client.query(
      `insert into sutra.memberships(clinic_id,user_id,administrator,active,clinician)
       values($1,$2,$3,$3,$4)
       on conflict(clinic_id,user_id) do nothing
       returning sutra.hospital_staff_assignment(memberships) as assignment`,
      [clinicId, userId, bootstrap, values.clinician],
    );
    if (!membership.rowCount) {
      throw new Error('This identity is already provisioned. Existing permissions were left intact.');
    }
    await client.query(
      'insert into sutra.hospital_staff_audit(clinic_id,target_user_id,current_assignment) values($1,$2,$3)',
      [clinicId, userId, membership.rows[0]!.assignment],
    );
    await client.query('commit');
    console.log(bootstrap ? 'Managed hospital created and initial administrator activated.' : 'Verified staff identity provisioned for administrator activation.');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  // Driver detail can include email addresses, connection strings or input values.
  const databaseError = typeof error === 'object' && error !== null && 'code' in error;
  console.error(!databaseError && error instanceof Error ? error.message : 'Hospital setup database operation failed.');
  process.exitCode = 1;
});
