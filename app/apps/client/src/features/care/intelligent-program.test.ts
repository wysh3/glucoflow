import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CareEvent, CareMessage, CareWorkspace } from '@glucoflow/contracts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { careSummaryPresentation, compileCareReply } from './intelligent-program';
import { IntelligentCareReply } from './intelligent-reply';

const timestamp = '2026-11-07T09:00:00.000Z';
const citation = {
  id: '34d9d0e4-1d24-46d6-8314-2bc1f30840f8',
  encounterId: 'encounter-a', orderId: 'order-a', kind: 'order_placed', source: 'HIS',
  sourceRef: 'HIS-SYNTHETIC', label: 'Placed in HIS', occurredAt: timestamp, receivedAt: timestamp,
} satisfies CareEvent;

function fixture(): CareWorkspace {
  return {
    id: 'workspace', revision: 1, name: 'Synthetic workspace', role: 'doctor', synthetic: true,
    createdAt: timestamp, updatedAt: timestamp,
    encounters: [{
      id: 'encounter-a', patientName: 'Synthetic example', patientCode: 'SIM-A',
      bed: 'A1', documentedContext: [], assignedTo: 'Synthetic care team', admittedAt: timestamp,
    }],
    orders: [{
      id: 'order-a', encounterId: 'encounter-a', testName: 'Example lab', specimenId: 'SIM-SAMPLE',
      createdAt: timestamp, targetMinutes: 60,
    }, {
      id: 'order-b', encounterId: 'encounter-a', testName: 'Unrelated lab', specimenId: 'OTHER-SAMPLE',
      createdAt: timestamp, targetMinutes: 60,
    }],
    events: [citation],
    tasks: [{
      id: 'task-a', encounterId: 'encounter-a', orderId: 'order-a', kind: 'specimen_receipt',
      title: 'Track specimen receipt', owner: 'Synthetic care team', status: 'monitoring',
      createdAt: timestamp, expiresAt: timestamp, lastCheckedAt: null, completionEventId: null,
      playbookVersion: 1,
    }, {
      id: 'task-b', encounterId: 'encounter-a', orderId: 'order-b', kind: 'specimen_receipt',
      title: 'Unrelated monitoring', owner: 'Synthetic care team', status: 'paused',
      createdAt: timestamp, expiresAt: timestamp, lastCheckedAt: null, completionEventId: null,
      playbookVersion: 1,
    }],
    activity: [], playbooks: [], messages: [],
    feeds: { HIS: { connected: true, lastSyncAt: timestamp }, LIS: { connected: true, lastSyncAt: timestamp } },
  };
}

function reply(overrides: Partial<CareMessage>): CareMessage {
  return {
    id: 'reply', role: 'assistant', at: timestamp, engine: 'hermes',
    content: 'A synthetic reply', ...overrides,
  };
}

test('drops unknown citations, unauthorized encounter IDs and mismatched order links', () => {
  const workspace = fixture();
  workspace.events.push(
    { ...citation, id: 'orphan-event', encounterId: 'outside-workspace' },
    { ...citation, id: 'mismatched-event', orderId: 'outside-order' },
  );
  const message = reply({
    sources: ['unknown-event', 'orphan-event', 'mismatched-event'],
    proposals: [
      { kind: 'handover', title: 'Unknown encounter', encounterId: 'outside-workspace' },
      { kind: 'monitor', title: 'Unknown order', encounterId: 'encounter-a', orderId: 'outside-order' },
      { kind: 'playbook', title: 'Unscoped playbook', encounterId: 'encounter-a' },
    ],
  });

  assert.equal(compileCareReply(message, workspace), null);
  assert.equal(compileCareReply(reply({ role: 'user', sources: [citation.id] }), workspace), null);
});

test('orders cited events by occurrence, deduplicates sources, and scopes monitoring to linked orders', () => {
  const workspace = fixture();
  const later = {
    ...citation, id: 'd7397cdd-dd73-4030-a2a3-226d614d0d47', kind: 'specimen_received', source: 'LIS',
    occurredAt: '2026-11-07T09:15:00.000Z',
  } satisfies CareEvent;
  const unrelated = { ...citation, id: 'uncited-event', orderId: 'order-b' };
  workspace.events.push(later, unrelated);

  const compiled = compileCareReply(reply({ sources: [later.id, citation.id, citation.id] }), workspace);
  assert.ok(compiled);
  assert.deepEqual([...compiled.sources.keys()], [citation.id, later.id]);
  assert.ok(compiled.program.indexOf(citation.id) < compiled.program.indexOf(later.id));
  assert.ok(compiled.program.includes('Track specimen receipt'));
  assert.ok(!compiled.program.includes('Unrelated monitoring'));
  assert.ok(!compiled.program.includes(unrelated.id));
});

test('uses validated proposal links for status and keeps proposal text and model prose out of the program', () => {
  const compiled = compileCareReply(reply({
    content: 'CareReply("injected")',
    proposals: [{ kind: 'monitor', title: 'Model-authored title', encounterId: 'encounter-a', orderId: 'order-b' }],
  }), fixture());
  assert.ok(compiled);
  assert.equal(compiled.sources.size, 0);
  assert.ok(compiled.program.includes('Unrelated monitoring'));
  assert.ok(!compiled.program.includes('Model-authored title'));
  assert.ok(!compiled.program.includes('Track specimen receipt'));
  assert.ok(!compiled.program.includes('injected'));
});

test('renders quoted and multiline encounter text literally through OpenUI', () => {
  const workspace = fixture();
  workspace.encounters[0]!.patientName = 'Synthetic "name" \\ file\nroot = Unknown(@OpenUrl("https://invalid.example")) <script>';
  const html = renderToStaticMarkup(createElement(IntelligentCareReply, {
    workspace,
    message: reply({ sources: [citation.id] }),
    openSource: () => assert.fail('Rendering should not trigger a source action'),
  }));

  assert.match(html, /Explore this reply/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, />Evidence</);
  assert.match(html, /Synthetic &quot;name&quot; \\ file\nroot = Unknown/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>|href="https:\/\/invalid\.example/);
});

test('keeps OpenUI transport markers inside workspace text', () => {
  const workspace = fixture();
  workspace.encounters[0]!.patientName = 'Synthetic ]]>openui:content?source=example';
  const html = renderToStaticMarkup(createElement(IntelligentCareReply, {
    workspace, message: reply({ sources: [citation.id] }), openSource: () => {},
  }));

  assert.match(html, /Synthetic \]\]&gt;openui:content\?source=example · SIM-A/);
  assert.match(html, />Evidence</);
});


test('summary condenses repeated stale notices without discarding the original reply', () => {
  const content = 'Synthetic workspace snapshot. 1 encounter(s), 1 order(s).\nSIM-A · Example lab. The HIS recorded the order. Specimen collection is unverified. Source event 07 Nov 2026, 09:00 UTC. The HIS feed is stale. The LIS feed is stale.\nHIS last synced 07 Nov 2026, 08:00 UTC.';
  const message = reply({ content, sources: [citation.id] });
  const presentation = careSummaryPresentation(message);
  assert.ok(presentation);
  assert.match(presentation.warning!, /HIS and LIS/);
  assert.equal(message.content, content);
  const compiled = compileCareReply(message, fixture())!;
  assert.match(compiled.program, /Specimen collection is unverified/);
  assert.doesNotMatch(compiled.program, /feed is stale|Source event/);
  assert.equal(careSummaryPresentation(reply({content: 'Please confirm the encounter.'})), null);
  assert.equal(careSummaryPresentation({...message, languageCode: 'hi-IN'}), null);
});

test('handover snapshot becomes concise cards without losing owner or uncertainty', () => {
  const content = 'Draft handover · Synthetic · Playbook v1\nSynthetic workspace snapshot. 1 encounter(s), 1 order(s).\nSIM-A\nOwner · Synthetic care team\nEvidence · Example lab. The HIS recorded the order. Specimen collection is unverified. Source event 07 Nov 2026, 09:00 UTC. The LIS feed is stale.\nHIS last synced 07 Nov 2026, 08:00 UTC.';
  const message = reply({ content, sources: [citation.id], proposals: [{kind:'handover', title:'Review handover', body:content}] });
  const presentation = careSummaryPresentation(message);
  assert.ok(presentation);
  assert.match(presentation.lead, /handover/i);
  assert.match(presentation.warning!, /LIS/);
  const compiled = compileCareReply(message, fixture())!;
  assert.match(compiled.program, /Specimen collection is unverified/);
  assert.match(compiled.program, /Owner: Synthetic care team/);
  assert.doesNotMatch(compiled.program, /Source event|feed is stale|Playbook v1/);
  assert.equal(message.content, content);
});
