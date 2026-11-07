import { randomUUID } from 'node:crypto';
import type { CarePlaybook, CareWorkspace } from '@glucoflow/contracts';
import { z } from 'zod';
import { ApiError } from '../errors';
import { assertRole, assertRoom, limits, logActivity, orderEvents, recordSourceEvent } from './events';
import { reconcileCareWorkspace } from './monitor';
import { playbookSchema } from './schema';
import { seedCareWorkspace } from './seed';

type HandoverOrder = z.infer<typeof playbookSchema>['handoverOrder'];

function readHandoverOrder(body: string): HandoverOrder | null {
  try {
    const result = playbookSchema.safeParse(JSON.parse(body));
    return result.success ? result.data.handoverOrder : null;
  } catch {
    return null;
  }
}

export function activePlaybook(state: CareWorkspace): CarePlaybook {
  const playbook = state.playbooks.find((item) => item.status === 'approved');
  if (!playbook) throw new Error('Care workspace is missing its active playbook.');
  return playbook;
}

function renderHandover(state: CareWorkspace, version: number, order: HandoverOrder, encounterId?: string) {
  const encounters = encounterId ? state.encounters.filter((item) => item.id === encounterId) : state.encounters;
  const sections: string[] = [`Draft handover · Synthetic · Playbook v${version}`];
  const sources: string[] = [];
  let included = 0;
  for (const encounter of encounters) {
    const events = state.events.filter((event) => event.encounterId === encounter.id).slice(-4);
    const owner = `Owner · ${encounter.assignedTo}`;
    const evidence = events.length
      ? `Evidence · ${events.map((event) => `${event.source} ${event.sourceRef} (${event.label})`).join(' | ')}`
      : 'Evidence · No matching source events recorded.';
    const outstanding = state.tasks.filter((task) => task.encounterId === encounter.id &&
      ['awaiting_approval', 'monitoring', 'paused', 'awaiting_evidence'].includes(task.status));
    const lines = [
      `${encounter.patientName} · ${encounter.patientCode} · ${encounter.bed}`,
      ...(order === 'source-first' ? [evidence, owner] : [owner, evidence]),
      ...(encounter.bedTransfer ? [`Transfer · ${encounter.bedTransfer.stage} · ${encounter.bedTransfer.destination} · staff-recorded synthetic reference ${encounter.bedTransfer.history.at(-1)?.sourceRef}`] : []),
      ...encounter.documentedContext.slice(0, 2).map((context) => `Documented · ${context}`),
      ...outstanding.slice(0, 3).map((task) => `Open · ${task.title} (${task.status.replaceAll('_', ' ')}) · ${task.owner}${task.transfer?.status === 'pending' ? ` · Handover awaiting acceptance by ${task.transfer.owner}; current owner retains responsibility` : ''}`),
    ];
    if (outstanding.length > 3) lines.push(`${outstanding.length - 3} additional open tasks: inspect this encounter's worklist before completing handover.`);
    const section = lines.join('\n');
    if (sections.join('\n\n').length + section.length > 3600 || sources.length + events.length > 40) break;
    sections.push(section);
    sources.push(...events.map((event) => event.id));
    included += 1;
  }
  if (included < encounters.length) {
    sections.push(`Showing ${included} of ${encounters.length} encounters. Draft individual encounters for the rest.`);
  }
  return { content: sections.join('\n\n'), sources };
}

export function draftHandover(state: CareWorkspace, encounterId?: string) {
  const playbook = activePlaybook(state);
  const order = readHandoverOrder(playbook.body);
  if (!order) throw new Error('The active care playbook has an invalid handover format.');
  return renderHandover(state, playbook.version, order, encounterId);
}

function runPlaybookTests(playbook: CarePlaybook): CarePlaybook['tests'] {
  const format = readHandoverOrder(playbook.body);
  if (!format) {
    return [{
      name: 'Allowed playbook schema', passed: false,
      detail: 'Use a JSON object with only handoverOrder set to owner-first or source-first.',
    }];
  }

  const now = new Date('2026-11-07T08:00:00.000Z');
  const at = now.toISOString();
  const sandbox = seedCareWorkspace(now);
  const pendingOrder = sandbox.orders[1]!;
  const pendingTask = sandbox.tasks.find((task) => task.orderId === pendingOrder.id)!;
  const unrelatedOrder = sandbox.orders[2]!;
  sandbox.role = 'lab';
  sandbox.feeds.LIS.connected = false;
  reconcileCareWorkspace(sandbox, at);
  const pausedForOutage = pendingTask.status === 'awaiting_evidence';
  sandbox.feeds.LIS.connected = true;
  reconcileCareWorkspace(sandbox, at);
  const unrelatedEvidenceIgnored = pendingTask.completionEventId === null &&
    orderEvents(sandbox, unrelatedOrder.encounterId, unrelatedOrder.id).some((event) => event.kind === 'specimen_received');

  recordSourceEvent(sandbox, {
    type: 'source_event', kind: 'specimen_received', source: 'LIS',
    sourceRef: 'LIS-PLAYBOOK-TEST', encounterId: pendingOrder.encounterId, orderId: pendingOrder.id,
  }, at);
  reconcileCareWorkspace(sandbox, at);
  const matchingEvent = sandbox.events.at(-1)!;
  const handover = renderHandover(sandbox, playbook.version, format, pendingOrder.encounterId);
  const ownerPosition = handover.content.indexOf('Owner ·');
  const evidencePosition = handover.content.indexOf('Evidence ·');
  const formatMatches = ownerPosition >= 0 && evidencePosition >= 0 &&
    (format === 'owner-first' ? ownerPosition < evidencePosition : evidencePosition < ownerPosition);

  return [
    { name: 'Allowed playbook schema', passed: true, detail: 'Only handover formatting is configurable.' },
    { name: 'Requested handover order', passed: formatMatches, detail: 'Rendered a synthetic handover using the proposed section order.' },
    {
      name: 'Source citations stay encounter-scoped',
      passed: handover.sources.includes(matchingEvent.id) &&
        handover.sources.every((id) => sandbox.events.some((event) => event.id === id && event.encounterId === pendingOrder.encounterId)),
      detail: 'Handover cites the simulated receipt and keeps the neighboring encounter out.',
    },
    {
      name: 'Completion still requires matching source evidence',
      passed: pausedForOutage && unrelatedEvidenceIgnored && pendingTask.completionEventId === matchingEvent.id,
      detail: 'Checked feed outage, an unrelated LIS receipt, and a matching LIS receipt.',
    },
  ];
}

export function proposePlaybook(state: CareWorkspace, title: string, body: string, at: string): void {
  assertRoom(state.playbooks, limits.playbooks, 'playbook version');
  const version = Math.max(...state.playbooks.map((item) => item.version)) + 1;
  state.playbooks.push({ id: randomUUID(), version, title, body, status: 'draft', createdAt: at, approvedAt: null, tests: [] });
  logActivity(state, at, 'playbook_proposed', `Playbook v${version} proposed`, title);
}

function playbookFor(state: CareWorkspace, id: string): CarePlaybook {
  const playbook = state.playbooks.find((item) => item.id === id);
  if (!playbook) throw ApiError.notFound('That playbook version is not available.');
  return playbook;
}

export function testPlaybook(state: CareWorkspace, id: string, at: string): void {
  const playbook = playbookFor(state, id);
  if (playbook.status !== 'draft') throw ApiError.conflict('Only draft playbooks can be tested.');
  playbook.tests = runPlaybookTests(playbook);
  const passed = playbook.tests.filter((test) => test.passed).length;
  logActivity(state, at, 'playbook_tested', `Playbook v${playbook.version} tested`, `${passed} of ${playbook.tests.length} tests passed.`);
}

export function reviewPlaybook(state: CareWorkspace, id: string, decision: 'approve' | 'reject', at: string): void {
  assertRole(state, 'doctor', 'coordinator');
  const playbook = playbookFor(state, id);
  if (playbook.status !== 'draft') throw ApiError.conflict('Only draft playbooks can be reviewed.');
  if (decision === 'reject') {
    playbook.status = 'rejected';
    logActivity(state, at, 'playbook_rejected', `Playbook v${playbook.version} rejected`, playbook.title);
    return;
  }

  if (!playbook.tests.length || !playbook.tests.every((test) => test.passed) || !readHandoverOrder(playbook.body)) {
    throw ApiError.conflict('Run and pass the playbook tests before approval.', 'playbook_tests_required');
  }
  activePlaybook(state).status = 'superseded';
  playbook.status = 'approved';
  playbook.approvedAt = at;
  logActivity(state, at, 'playbook_approved', `Playbook v${playbook.version} approved`, 'New handovers use this version. Existing tasks retain their version.');
}

export function rollbackPlaybook(state: CareWorkspace, id: string, at: string): void {
  assertRole(state, 'doctor', 'coordinator');
  const previous = playbookFor(state, id);
  if (previous.status !== 'superseded' || !previous.approvedAt || !readHandoverOrder(previous.body)) {
    throw ApiError.conflict('Choose a previously approved playbook version to restore.');
  }
  assertRoom(state.playbooks, limits.playbooks, 'playbook version');
  const version = Math.max(...state.playbooks.map((item) => item.version)) + 1;
  activePlaybook(state).status = 'superseded';
  state.playbooks.push({
    ...previous, id: randomUUID(), version, createdAt: at, approvedAt: at, status: 'approved',
  });
  logActivity(state, at, 'playbook_rolled_back', `Playbook v${version} activated`, `Restored the configuration approved for v${previous.version}.`);
}
