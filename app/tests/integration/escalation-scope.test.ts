import { expect, it } from 'vitest';
import { acceptCustody, createResult, escalateOverdueResults } from '@glucoflow/data';
import { createTestContext, createFixture, removeClinic, errorCode } from './harness';
it('refuses global or other-clinic escalation while preserving an authorized clinic action', async () => {
  const context = await createTestContext();
  const fixture = await createFixture(context, 'escalation-scope');
  try {
    expect(await errorCode(context.asActor(fixture.reviewerId, c => c.query('select sutra.escalate_overdue_results(null)')))).toBe('42501');
    expect(await errorCode(context.asActor(fixture.reviewerId, c => c.query('select sutra.escalate_overdue_results($1)', [fixture.otherClinicId])))).toBe('42501');
    const own = await context.asActor(fixture.reviewerId, c => c.query('select sutra.escalate_overdue_results($1) as count', [fixture.clinicId]));
    expect(own.rows[0].count).toBe(0);
    const permission = await context.ownerPool.query("select has_function_privilege($1, 'sutra.escalate_overdue_results(uuid)', 'execute') as allowed", [context.workerRole]);
    expect(permission.rows[0].allowed).toBe(false);

    const receivedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const resultId = await context.asActor(fixture.reviewerId, async (client) => {
      const id = await createResult(client, fixture.clinicId, {
        patientId: fixture.patientId,
        sourceChannel: 'whatsapp',
        reportReceivedAt: receivedAt,
        labReleasedAt: receivedAt,
        patientNameRaw: 'Synthetic escalation subject',
        patientIdentifierRaw: fixture.patientIdentifier,
        testName: 'Potassium',
        valueText: '5.9',
        unit: 'mmol/L',
        labFlag: 'critical',
        labHold: false,
        resultKind: 'unscheduled',
      });
      await acceptCustody(client, id);
      return id;
    });
    const escalate = () => context.asActor(fixture.clinicianId, (client) =>
      escalateOverdueResults(client, fixture.clinicId));
    expect(await escalate()).toBe(1);
    expect(await escalate()).toBe(0);

    await context.owner(async (client) => {
      const { rows: events } = await client.query(
        "select actor_id, detail->>'level' as level from sutra.result_events where result_id = $1 and event_type = 'auto_escalated'",
        [resultId],
      );
      expect(events).toEqual([{ actor_id: fixture.clinicianId, level: '1' }]);
      const { rows: notifications } = await client.query(
        'select level, recipient_role, channel, status from sutra.result_notifications where result_id = $1',
        [resultId],
      );
      expect(notifications).toEqual([{ level: 1, recipient_role: 'medical_superintendent', channel: 'in_app', status: 'queued' }]);
    });
  } finally {
    await removeClinic(context, fixture.clinicId); await removeClinic(context, fixture.otherClinicId); await context.close();
  }
});
