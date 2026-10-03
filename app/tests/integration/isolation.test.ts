import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createFixture,
  createTestContext,
  errorCode,
  removeClinic,
  stageFixtureUpload,
  type TestContext,
} from './harness';

/**
 * Identity and tenant isolation. Two clinics hold identically named patients, and a
 * patient cannot approve, cannot read another patient and cannot read clinic audit
 * metadata. Row level security is exercised through the same role the API uses.
 */

let context: TestContext;

beforeAll(async () => {
  context = await createTestContext();
});

afterAll(async () => {
  await context.close();
});

describe('tenant isolation', () => {
  it('hides another clinic patient even with an identical name and identifier', async () => {
    const fixture = await createFixture(context, 'isolation');
    try {
      const visible = await context.asActor(fixture.reviewerId, async (client) => {
        const result = await client.query<{ id: string }>('select id from sutra.patients');
        return result.rows.map((row) => row.id);
      });
      expect(visible).toContain(fixture.patientId);
      expect(visible).not.toContain(fixture.otherPatientId);
    } finally {
      await removeClinic(context, fixture.clinicId);
      await removeClinic(context, fixture.otherClinicId);
    }
  });

  it('denies an inactive membership', async () => {
    const fixture = await createFixture(context, 'inactive');
    try {
      await context.owner(async (client) => {
        await client.query('update sutra.memberships set active = false where user_id = $1', [
          fixture.reviewerId,
        ]);
      });
      const visible = await context.asActor(fixture.reviewerId, async (client) => {
        const result = await client.query('select id from sutra.patients');
        return result.rowCount;
      });
      expect(visible).toBe(0);
    } finally {
      await removeClinic(context, fixture.clinicId);
      await removeClinic(context, fixture.otherClinicId);
    }
  });

  it('does not leak rows when one pooled connection serves two actors', async () => {
    const fixture = await createFixture(context, 'pool');
    try {
      const first = await context.asActor(fixture.reviewerId, async (client) => {
        const result = await client.query<{ id: string }>('select id from sutra.patients');
        return result.rows.map((row) => row.id);
      });
      const second = await context.asActor(fixture.otherReviewerId, async (client) => {
        const result = await client.query<{ id: string }>('select id from sutra.patients');
        return result.rows.map((row) => row.id);
      });
      expect(first).toContain(fixture.patientId);
      expect(second).toContain(fixture.otherPatientId);
      expect(second).not.toContain(fixture.patientId);
    } finally {
      await removeClinic(context, fixture.clinicId);
      await removeClinic(context, fixture.otherClinicId);
    }
  });

  it('lets a patient read only their own record and never clinic audit metadata', async () => {
    const fixture = await createFixture(context, 'patient-scope');
    try {
      const result = await context.asActor(fixture.patientUserId, async (client) => {
        const patients = await client.query<{ id: string }>('select id from sutra.patients');
        const audit = await client.query('select id from sutra.audit_events');
        const documents = await client.query('select id from sutra.documents');
        return {
          patients: patients.rows.map((row) => row.id),
          auditCount: audit.rowCount,
          documents: documents.rowCount,
        };
      });
      expect(result.patients).toEqual([fixture.patientId]);
      expect(result.auditCount).toBe(0);
    } finally {
      await removeClinic(context, fixture.clinicId);
      await removeClinic(context, fixture.otherClinicId);
    }
  });

  it('refuses a direct approval attempt from a patient account', async () => {
    const fixture = await createFixture(context, 'patient-approve');
    try {
      const staged = await stageFixtureUpload(context, fixture, {
        filename: '2026-01-12_lab_report.pdf',
      });
      const code = await errorCode(
        context.asActor(fixture.patientUserId, async (client) => {
          // The patient can read their own document row, so the refusal must come
          // from the procedure's own membership check rather than from visibility.
          await client.query('select sutra.publish_review($1, 0, $2::jsonb)', [
            staged.documentId,
            '[]',
          ]);
        }),
      );
      expect(code).toBe('42501');
    } finally {
      await removeClinic(context, fixture.clinicId);
      await removeClinic(context, fixture.otherClinicId);
    }
  });

  it('refuses a clinic member with a clinician-only membership access to drafts', async () => {
    const fixture = await createFixture(context, 'clinician-only');
    try {
      const result = await context.asActor(fixture.clinicianId, async (client) => {
        const batches = await client.query('select id from sutra.review_batches');
        const facts = await client.query('select id from sutra.draft_facts');
        return { batches: batches.rowCount, facts: facts.rowCount };
      });
      expect(result.batches).toBe(0);
      expect(result.facts).toBe(0);
    } finally {
      await removeClinic(context, fixture.clinicId);
      await removeClinic(context, fixture.otherClinicId);
    }
  });

  it('refuses an unsigned actor with no context at all', async () => {
    const fixture = await createFixture(context, 'no-context');
    try {
      const result = await context.asActor('00000000-0000-4000-8000-000000000000', async (client) => {
        const patients = await client.query('select id from sutra.patients');
        return patients.rowCount;
      });
      expect(result).toBe(0);
    } finally {
      await removeClinic(context, fixture.clinicId);
      await removeClinic(context, fixture.otherClinicId);
    }
  });
});
