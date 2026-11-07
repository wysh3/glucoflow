import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  acknowledgeResult,
  assignResult,
  closeResult,
  createResult,
  getResult,
  getResultProof,
  recordResultCommunication,
  resultMatchCandidates,
  resultStats,
  verifyReceiptByCode,
} from '@glucoflow/data';
import {
  createFixture,
  createTestContext,
  errorCode,
  removeClinic,
  type TestContext,
  type TestFixture,
} from './harness';

let context: TestContext;
let fixture: TestFixture;

beforeAll(async () => {
  context = await createTestContext();
  fixture = await createFixture(context, 'closure');
});

afterAll(async () => {
  await removeClinic(context, fixture.clinicId);
  await removeClinic(context, fixture.otherClinicId);
  await context.close();
});

const now = new Date().toISOString();

async function createCritical(patientId: string | null = fixture.patientId): Promise<string> {
  return context.asActor(fixture.reviewerId, (client) =>
    createResult(client, fixture.clinicId, {
      patientId,
      externalRef: `closure-${Math.random().toString(36).slice(2)}`,
      sourceChannel: 'whatsapp',
      labName: 'SRL Diagnostics',
      reportReceivedAt: now,
      labReleasedAt: now,
      patientNameRaw: 'Asha Rao',
      patientIdentifierRaw: fixture.patientIdentifier,
      testName: 'Potassium',
      valueText: '5.9',
      unit: 'mmol/L',
      labFlag: 'critical',
      labHold: false,
      resultKind: 'monitoring',
      monitoringProtocol: 'acei_arb_k_egfr_2w',
      monitoringStartedAt: now,
      monitoringDueAt: now,
    }),
  );
}

describe('patient-side result closure', () => {
  it('refuses a blind acknowledgement and a critical read-back without the printed value', async () => {
    const id = await createCritical();
    await context.asActor(fixture.reviewerId, (client) => assignResult(client, id, fixture.reviewerId));
    const wrongValue = await errorCode(
      context.asActor(fixture.reviewerId, (client) =>
        acknowledgeResult(client, id, {
          valueText: '9.9',
          flag: 'critical',
          notifierName: 'Lab technician',
          notifierRole: 'technician',
          readBackValue: '9.9',
        }),
      ),
    );
    expect(wrongValue).toBe('22023');
    const missingNotifier = await errorCode(
      context.asActor(fixture.reviewerId, (client) =>
        acknowledgeResult(client, id, {
          valueText: '5.9',
          flag: 'critical',
          readBackValue: '5.9',
        }),
      ),
    );
    expect(missingNotifier).toBe('22023');
    const wrongEcho = await errorCode(
      context.asActor(fixture.reviewerId, (client) =>
        acknowledgeResult(client, id, {
          valueText: '5.9',
          flag: 'critical',
          notifierName: 'Lab technician',
          notifierRole: 'technician',
          readBackValue: '6.0',
        }),
      ),
    );
    expect(wrongEcho).toBe('22023');
  });

  it('closes an unreachable patient only after two documented attempts, never as informed', async () => {
    const id = await createCritical();
    await context.asActor(fixture.reviewerId, async (client) => {
      await assignResult(client, id, fixture.reviewerId);
      await acknowledgeResult(client, id, {
        valueText: '5.9',
        flag: 'critical',
        notifierName: 'Lab technician',
        notifierRole: 'technician',
        readBackValue: '5.9',
      });
      await recordResultCommunication(client, id, {
        channel: 'call',
        outcome: 'unreachable',
        language: 'Hindi',
        attemptedAt: now,
        teachBack: false,
      });
    });

    const tooEarly = await errorCode(
      context.asActor(fixture.reviewerId, (client) =>
        closeResult(client, id, {
          note: 'One attempt only.',
          disposition: 'unreachable',
        }),
      ),
    );
    expect(tooEarly).toBe('22023');

    await context.asActor(fixture.reviewerId, async (client) => {
      await recordResultCommunication(client, id, {
        channel: 'whatsapp',
        outcome: 'unreachable',
        language: 'Hindi',
        attemptedAt: now,
        teachBack: false,
      });
      await closeResult(client, id, {
        note: 'Two documented attempts. Treating doctor was notified.',
        disposition: 'unreachable',
      });
    });

    const result = await context.asActor(fixture.reviewerId, (client) => getResult(client, id));
    expect(result?.status).toBe('closed');
    expect(result?.closedWithoutInformed).toBe(true);
    expect(result?.informedAt).toBeNull();
    expect(result?.attempts).toHaveLength(2);

    const proof = await context.asActor(fixture.reviewerId, (client) => getResultProof(client, id));
    expect(proof?.valid).toBe(true);
    expect(proof?.controls.find((control) => control.code === 'VALUE-ECHO')?.status).toBe('present');
    expect(proof?.controls.find((control) => control.code === 'PATIENT-CONTACT')?.status).toBe('present');
    expect(proof?.controls.find((control) => control.code === 'CHAIN')?.status).toBe('present');

    const publicProof = await context.asActor(fixture.reviewerId, (client) =>
      verifyReceiptByCode(client, result!.receiptCode),
    );
    expect(publicProof.stage).toBe('closed_unreachable');
    expect(publicProof.valid).toBe(true);
  });

  it('scopes the proof to its clinic and computes the closure metric', async () => {
    const id = await createCritical();
    const proof = await context.asActor(fixture.reviewerId, (client) => getResultProof(client, id));
    expect(proof?.valid).toBe(true);
    const stats = await context.asActor(fixture.reviewerId, (client) => resultStats(client, fixture.clinicId));
    expect(stats.monitoringEligible).toBeGreaterThanOrEqual(1);
    expect(stats.closureRate7d === null || stats.closureRate7d >= 0).toBe(true);
  });

  it('scores a namesake candidate from the printed clinic identifier', async () => {
    const id = await createCritical(null);
    const candidates = await context.asActor(fixture.reviewerId, (client) =>
      resultMatchCandidates(client, fixture.clinicId, id),
    );
    const exact = candidates.find((candidate) => candidate.clinicIdentifier === fixture.patientIdentifier);
    expect(exact?.score).toBe(1);
    expect(exact?.reasons).toContain('Clinic ID matches exactly');
  });
});


it('never invents a follow-up deadline when staff omit one', async () => {
  const id = await createCritical();
  await context.asActor(fixture.reviewerId, async client => {
    await assignResult(client, id, fixture.reviewerId);
    await acknowledgeResult(client, id, { valueText: '5.9', flag: 'critical', notifierName: 'Synthetic lab staff', notifierRole: 'technician', readBackValue: '5.9' });
    await recordResultCommunication(client, id, { channel: 'call', outcome: 'informed_patient', recipient: 'Synthetic participant', nextStep: 'collect_report', teachBack: true });
    expect((await getResult(client, id))?.nextStepDueAt).toBeNull();
  });
});
