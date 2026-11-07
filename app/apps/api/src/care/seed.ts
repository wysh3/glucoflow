import { randomUUID } from 'node:crypto';
import type { CareEncounter, CareEvent, CareOrder, CareTask, CareWorkspace } from '@glucoflow/contracts';

const minutes = (n: number) => n * 60_000;
const examples = [
  {
    name: 'Asha Shah', bed: 'ICU 04', clinician: 'Dr Mira Rao', test: 'Basic metabolic panel',
    context: ['HIS admission note documents DKA.', 'Transferred from the emergency department to ICU 04.'],
  },
  {
    name: 'Dev Mehta', bed: 'ICU 07', clinician: 'Dr Mira Rao', test: 'Venous blood gas',
    context: ['HIS admission note documents DKA.', 'HIS transfer note lists known CKD and a nephrology team handover.'],
  },
  {
    name: 'Sara Khan', bed: 'Ward 12', clinician: 'Dr Anil Sen', test: 'Serum beta-hydroxybutyrate',
    context: ['HIS admission note documents DKA.', 'LIS marks the first ordered result as validated.'],
  },
];

export function seedCareWorkspace(now: Date): CareWorkspace {
  const at = now.toISOString();
  const ago = (n: number) => new Date(now.getTime() - minutes(n)).toISOString();
  const encounters: CareEncounter[] = [];
  const orders: CareOrder[] = [];
  const events: CareEvent[] = [];
  const tasks: CareTask[] = [];

  for (const [index, sample] of examples.entries()) {
    const n = index + 1;
    const encounter: CareEncounter = {
      id: randomUUID(), patientName: sample.name, patientCode: `DEMO-10${n}`, bed: sample.bed,
      assignedTo: sample.clinician, admittedAt: ago(index === 1 ? 100 : 40 + n), documentedContext: sample.context,
    };
    const order: CareOrder = {
      id: randomUUID(), encounterId: encounter.id, testName: sample.test,
      specimenId: `SIM-SPEC-10${n}`, createdAt: ago(index === 1 ? 75 : 12), targetMinutes: 60,
    };
    encounters.push(encounter);
    orders.push(order);
    const record = (kind: CareEvent['kind'], source: CareEvent['source'], label: string, age: number) => {
      events.push({
        id: randomUUID(), encounterId: encounter.id, orderId: order.id, kind, source,
        sourceRef: `${source}-SIM-${n}-${kind}`, label, occurredAt: ago(age), receivedAt: ago(age),
      });
    };
    record('order_placed', 'HIS', 'Order placed in the synthetic HIS', index === 1 ? 75 : 12);
    if (index >= 1) record('specimen_collected', 'HIS', 'Nurse recorded specimen collection', index === 1 ? 70 : 9);
    if (index === 2) {
      record('specimen_received', 'LIS', 'Lab recorded specimen receipt', 7);
      record('result_validated', 'LIS', 'Lab validated result for review', 3);
    }
    tasks.push({
      id: randomUUID(), encounterId: encounter.id, orderId: order.id,
      kind: index === 2 ? 'result_acknowledgement' : 'specimen_receipt',
      title: index === 2 ? 'Confirm clinician acknowledgement' : 'Confirm specimen receipt',
      owner: index === 2 ? encounter.assignedTo : 'Lab team',
      status: index === 0 ? 'awaiting_approval' : 'monitoring',
      createdAt: ago(2), expiresAt: new Date(now.getTime() + minutes(58)).toISOString(),
      lastCheckedAt: index === 0 ? null : at, completionEventId: null, playbookVersion: 1,
    });
  }

  return {
    id: randomUUID(), revision: 1, name: 'Inpatient coordination demo', synthetic: true,
    role: 'doctor', createdAt: at, updatedAt: at, encounters, orders, events, tasks,
    activity: [{
      id: randomUUID(), at, kind: 'workspace_created', title: 'Simulation workspace created',
      detail: 'Seeded synthetic HIS and LIS records for three encounters.',
    }],
    playbooks: [{
      id: randomUUID(), version: 1, title: 'Shift handover format',
      body: '{"handoverOrder":"owner-first"}', status: 'approved',
      createdAt: at, approvedAt: at, tests: [],
    }],
    coordination: {
      staff: [
        {id:randomUUID(),name:'Lab follow-up team (synthetic)',userId:null,role:'lab',team:'Lab team',capabilities:['specimen_followup'],shiftEnd:new Date(now.getTime()+minutes(480)).toISOString(),capacity:null},
        {id:randomUUID(),name:'Receiving clinician (synthetic)',userId:null,role:'doctor',team:'Receiving team',capabilities:['result_followup','handover'],shiftEnd:new Date(now.getTime()+minutes(480)).toISOString(),capacity:null},
        {id:randomUUID(),name:'Ward nurse (synthetic)',userId:null,role:'nurse',team:'Ward team',capabilities:['documentation','specimen_followup'],shiftEnd:new Date(now.getTime()+minutes(480)).toISOString(),capacity:null},
      ],assignments:[],handovers:[],records:[],
    },
    messages: [],
    feeds: { HIS: { connected: true, lastSyncAt: at }, LIS: { connected: true, lastSyncAt: at } },
  };
}
