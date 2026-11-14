import { randomUUID } from 'node:crypto';
import type { CareEncounter, CareEvent, CareOrder, CareTask, CareWorkspace, CareStaff } from '@glucoflow/contracts';

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

export type CarePreset = 'classic' | 'showcase';

export function seedCareWorkspace(now: Date, preset: CarePreset = 'classic'): CareWorkspace {
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

  if (preset === 'showcase') appendScenarios(now, encounters, orders, events, tasks);

  const staff = createDemoStaff(now);
  return {
    demoStaffId: staff[0]!.id, demoProfilesVersion: 1,
    id: randomUUID(), revision: 1, name: preset === 'showcase' ? 'Diabetes unit shift demo' : 'Inpatient coordination demo', synthetic: true,
    role: 'doctor', createdAt: at, updatedAt: at, encounters, orders, events, tasks,
    activity: [{
      id: randomUUID(), at, kind: 'workspace_created', title: 'Simulation workspace created',
      detail: `Seeded synthetic HIS and LIS records for ${encounters.length} encounters.`,
    }],
    playbooks: [{
      id: randomUUID(), version: 1, title: 'Shift handover format',
      body: '{"handoverOrder":"owner-first"}', status: 'approved',
      createdAt: at, approvedAt: at, tests: [],
    }],
    coordination: {
      staff,assignments:[],handovers:[],records:[],
    },
    messages: [],
    feeds: { HIS: { connected: true, lastSyncAt: at }, LIS: { connected: true, lastSyncAt: at } },
  };
}

export function createDemoStaff(now: Date): CareStaff[] {
  const staff: CareStaff[] = [
    {name:'Dr Mira Rao',role:'doctor',team:'Emergency',capabilities:['result_followup','handover','documentation']},
    {name:'Dr Anil Sen',role:'doctor',team:'Receiving clinical team',capabilities:['result_followup','handover','documentation']},
    {name:'Anita Joseph',role:'nurse',team:'Emergency nursing',capabilities:['specimen_followup','documentation']},
    {name:'Ravi Kumar',role:'nurse',team:'Ward nursing',capabilities:['specimen_followup','documentation']},
    {name:'Priya Shah',role:'lab',team:'Laboratory',capabilities:['specimen_followup','documentation']},
    {name:'Imran Ali',role:'lab',team:'Laboratory',capabilities:['specimen_followup','documentation']},
    {name:'Neha Patel',role:'coordinator',team:'Admission and placement',capabilities:['documentation']},
    {name:'Arun Menon',role:'coordinator',team:'Admission and placement',capabilities:['documentation']},
  ].map(item => ({...item, id:randomUUID(), userId:null, shiftEnd:new Date(now.getTime()+minutes(480)).toISOString(),capacity:null})) as CareStaff[];
  return staff;
}

type Step = { kind: CareEvent['kind']; age: number; label: string };
interface Scenario {
  name: string; bed: string; clinician: string; admittedAgo: number; context: string[];
  test: string; orderedAgo: number; targetMinutes: number; steps: Step[];
  task: { kind: CareTask['kind']; title: string; owner?: string; status: CareTask['status']; completedBy?: CareEvent['kind'] };
  transfer?: { destination: string; age: number };
}

const sourceOf = (kind: CareEvent['kind']): CareEvent['source'] =>
  kind === 'specimen_received' || kind === 'result_validated' || kind === 'result_corrected' ? 'LIS' : 'HIS';

// Additional fictional operational scenarios. Context lines are documentation the simulated HIS supplies;
// none of them is a diagnosis, risk estimate or treatment instruction generated by the app.
export const scenarioLibrary: Scenario[] = [
  {
    name: 'Ramesh Iyer', bed: 'HDU 02', clinician: 'Dr Anil Sen', admittedAgo: 180,
    context: ['Fictional HIS admission note documents HHS.', 'Renal team review requested in HIS; acceptance not yet recorded.'],
    test: 'Serum osmolality', orderedAgo: 110, targetMinutes: 60,
    steps: [{ kind: 'specimen_collected', age: 100, label: 'Nurse recorded specimen collection' }],
    task: { kind: 'specimen_receipt', title: 'Confirm specimen receipt', owner: 'Lab team', status: 'monitoring' },
  },
  {
    name: 'Lakshmi Pillai', bed: 'Ward 09', clinician: 'Dr Mira Rao', admittedAgo: 1440,
    context: ['Fictional nursing note records a low ward glucose reading and the response documented by the ward team.', 'Lab confirmation sample sent; clinician acknowledgement of the validated result is pending.'],
    test: 'Plasma glucose (lab confirmation)', orderedAgo: 50, targetMinutes: 60,
    steps: [
      { kind: 'specimen_collected', age: 45, label: 'Nurse recorded specimen collection' },
      { kind: 'specimen_received', age: 40, label: 'Lab recorded specimen receipt' },
      { kind: 'result_validated', age: 18, label: 'Lab validated result for review' },
    ],
    task: { kind: 'result_acknowledgement', title: 'Confirm clinician acknowledgement', status: 'monitoring' },
  },
  {
    name: 'Arjun Reddy', bed: 'OT Recovery 1', clinician: 'Dr Anil Sen', admittedAgo: 600,
    context: ['Fictional HIS note documents a post-operative insulin infusion protocol under the surgical team.', 'Transfer to Surgical Ward 05 requested; receiving-team acceptance is recorded separately from bed movement.'],
    test: 'Serum potassium (pre-transfer)', orderedAgo: 90, targetMinutes: 60,
    steps: [
      { kind: 'specimen_collected', age: 85, label: 'Nurse recorded specimen collection' },
      { kind: 'specimen_received', age: 78, label: 'Lab recorded specimen receipt' },
      { kind: 'result_validated', age: 60, label: 'Lab validated result for review' },
      { kind: 'result_acknowledged', age: 52, label: 'Clinician acknowledgement recorded in HIS' },
    ],
    task: { kind: 'result_acknowledgement', title: 'Confirm clinician acknowledgement', status: 'source_confirmed', completedBy: 'result_acknowledged' },
    transfer: { destination: 'Surgical Ward 05', age: 40 },
  },
  {
    name: 'Fatima Begum', bed: 'Ward 14', clinician: 'Dr Mira Rao', admittedAgo: 2880,
    context: ['Fictional HIS note documents a diabetic foot wound under podiatry review.', 'Vascular surgery consult requested in HIS; response not yet recorded.'],
    test: 'Wound swab culture', orderedAgo: 360, targetMinutes: 1440,
    steps: [
      { kind: 'specimen_collected', age: 340, label: 'Nurse recorded specimen collection' },
      { kind: 'specimen_received', age: 300, label: 'Lab recorded specimen receipt' },
    ],
    task: { kind: 'result_acknowledgement', title: 'Confirm clinician acknowledgement', status: 'monitoring' },
  },
  {
    name: 'Vikram Singh', bed: 'ICU 02', clinician: 'Dr Mira Rao', admittedAgo: 300,
    context: ['Fictional HIS admission note documents DKA.', 'LIS issued a corrected result after the first version was acknowledged.'],
    test: 'Serum potassium', orderedAgo: 140, targetMinutes: 60,
    steps: [
      { kind: 'specimen_collected', age: 135, label: 'Nurse recorded specimen collection' },
      { kind: 'specimen_received', age: 128, label: 'Lab recorded specimen receipt' },
      { kind: 'result_validated', age: 110, label: 'Lab validated result for review' },
      { kind: 'result_acknowledged', age: 100, label: 'Clinician acknowledgement recorded in HIS' },
      { kind: 'result_corrected', age: 25, label: 'Lab issued a corrected result' },
    ],
    task: { kind: 'result_acknowledgement', title: 'Acknowledge corrected result', status: 'monitoring' },
  },
  {
    name: 'Meena Krishnan', bed: 'Antenatal 03', clinician: 'Dr Anil Sen', admittedAgo: 240,
    context: ['Fictional antenatal note documents gestational diabetes follow-up.', 'Obstetrics and endocrinology are both listed; result follow-up owner to be confirmed.'],
    test: '75 g oral glucose tolerance test', orderedAgo: 25, targetMinutes: 180, steps: [],
    task: { kind: 'specimen_receipt', title: 'Confirm specimen receipt', owner: 'Lab team', status: 'awaiting_approval' },
  },
];

function appendScenarios(now: Date, encounters: CareEncounter[], orders: CareOrder[], events: CareEvent[], tasks: CareTask[]) {
  const at = now.toISOString();
  const ago = (n: number) => new Date(now.getTime() - minutes(n)).toISOString();
  for (const sample of scenarioLibrary) {
    const n = encounters.length + 1;
    const encounter: CareEncounter = {
      id: randomUUID(), patientName: sample.name, patientCode: `DEMO-1${String(n).padStart(2, '0')}`, bed: sample.bed,
      assignedTo: sample.clinician, admittedAt: ago(sample.admittedAgo), documentedContext: sample.context,
    };
    if (sample.transfer) {
      const requestedAt = ago(sample.transfer.age);
      encounter.bedTransfer = { stage: 'requested', destination: sample.transfer.destination, requestedAt, history: [
        { stage: 'requested', destination: sample.transfer.destination, sourceRef: `HIS-SIM-${n}-transfer`, at: requestedAt, role: 'doctor' },
      ] };
    }
    const order: CareOrder = {
      id: randomUUID(), encounterId: encounter.id, testName: sample.test,
      specimenId: `SIM-SPEC-1${String(n).padStart(2, '0')}`, createdAt: ago(sample.orderedAgo), targetMinutes: sample.targetMinutes,
    };
    encounters.push(encounter);
    orders.push(order);
    const steps: Step[] = [{ kind: 'order_placed', age: sample.orderedAgo, label: 'Order placed in the synthetic HIS' }, ...sample.steps];
    let completionEventId: string | null = null;
    for (const step of steps) {
      const source = sourceOf(step.kind);
      const id = randomUUID();
      events.push({
        id, encounterId: encounter.id, orderId: order.id, kind: step.kind, source,
        sourceRef: `${source}-SIM-${n}-${step.kind}`, label: step.label, occurredAt: ago(step.age), receivedAt: ago(step.age),
      });
      if (sample.task.completedBy === step.kind) completionEventId = id;
    }
    tasks.push({
      id: randomUUID(), encounterId: encounter.id, orderId: order.id, kind: sample.task.kind, title: sample.task.title,
      owner: sample.task.owner ?? encounter.assignedTo, status: sample.task.status,
      createdAt: ago(Math.max(1, sample.orderedAgo - 2)), expiresAt: new Date(now.getTime() + minutes(sample.targetMinutes > 60 ? 600 : 90)).toISOString(),
      lastCheckedAt: sample.task.status === 'awaiting_approval' ? null : at, completionEventId, playbookVersion: 1,
    });
  }
}
