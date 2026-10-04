import { createServer, type Server } from 'node:http';
import { afterEach, it, expect } from 'vitest';
import {
  createConversationService,
  type ConversationRecords,
} from './conversation';
import {
  createGuideBudget,
  createGuideService,
  type GuideConfig,
} from './service';
import type {
  GuideChatRequest,
  TimelineObservation,
} from '@glucoflow/contracts';
let listener: Server | undefined;
afterEach(async () => {
  if (listener) await new Promise<void>((r) => listener!.close(() => r()));
  listener = undefined;
});
const config: GuideConfig = {
  mode: 'local',
  baseUrl: '',
  hourlyLimit: 3,
  maxConcurrent: 2,
  timeoutMs: 100,
};
const o = (
  id: string,
  date: string | null,
  value: string,
  precision: TimelineObservation['datePrecision'] = 'day',
): TimelineObservation => ({
  factId: id,
  testCode: 'hba1c',
  displayName: 'HbA1c',
  rawValue: value,
  rawUnit: '%',
  numericValue: Number(value),
  unit: '%',
  date,
  datePrecision: precision,
  dateKind: 'collection',
  referenceRangeText: null,
  plotEligible: true,
  groupId: null,
  documentId: 'doc',
  documentVersionId: 'version',
  approvalRevision: 1,
  status: 'retained',
  evidence: [
    {
      evidenceId: 'e',
      documentVersionId: 'version',
      page: 2,
      quote: `HbA1c ${value}%`,
      bbox: null,
      origin: 'pdf_text',
    },
  ],
});
const records: ConversationRecords = {
  patient: {
    patientId: '11111111-1111-4111-8111-111111111111',
    displayName: 'Synthetic Asha',
    clinicIdentifier: 'SYN',
  },
  timeline: {
    observations: [
      o('latest', '2026-10-03', '7.8'),
      o('previous', '2026-08-01', '8.1'),
      o('undated', null, '9.0'),
    ],
    events: [],
    notes: [],
    observationTotal: 3,
    eventTotal: 0,
    noteTotal: 0,
    latestReportDate: '2026-10-03',
    awaitingReviewCount: 4,
    sourceOnlyCount: 0,
  },
  home: [],
  homeTotal: 0,
};
const question = (
  message: string,
  history: string[] = [],
): GuideChatRequest => ({
  message,
  history,
  screen: 'overview',
  patientId: records.patient.patientId,
});
const ask = (message: string, history: string[] = [], r = records) =>
  createConversationService(config).answer(
    question(message, history),
    r,
    'clinician',
  );
it('answers a result and follow-up with exact source-backed values', async () => {
  const a = await ask('What is the latest HbA1c?');
  expect(a.cards).toEqual([
    expect.objectContaining({
      id: 'latest',
      detail: '7.8 %',
      source: expect.objectContaining({ page: 2, quote: 'HbA1c 7.8%' }),
    }),
  ]);
  const b = await ask('And the previous one?', ['What is the latest HbA1c?']);
  expect(b.cards[0]?.id).toBe('previous');
  const c = await ask('Show the source for that result', [
    'What is the latest HbA1c?',
    'And the previous one?',
  ]);
  expect(c.cards[0]?.id).toBe('previous');
});
it('includes undated history but never calls a partial date the latest', async () => {
  const r = {
    ...records,
    timeline: {
      ...records.timeline,
      observations: [
        o('partial', '2026-12-01', '9.1', 'month'),
        ...records.timeline.observations,
      ],
      observationTotal: 4,
    },
  };
  expect((await ask('latest HbA1c', [], r)).cards[0]?.id).toBe('latest');
  const a = await ask('HbA1c history', [], r);
  expect(a.cards.map((c) => c.id)).toContain('partial');
  expect(a.cards[0]?.dateLabel).toContain('month precision');
});
it('discloses bounded coverage and missing facts without inferring missing tests', async () => {
  const r = {
    ...records,
    timeline: { ...records.timeline, observations: [], observationTotal: 2500 },
  };
  const a = await ask('HbA1c result', [], r);
  expect(a.cards).toEqual([]);
  expect(a.message).toContain('doesn’t mean');
  expect(a.scopeNote).toContain('limited collection');
});
it('separates documented instructions from advice and never treats synthetic chart as a record', async () => {
  const r = {
    ...records,
    timeline: {
      ...records.timeline,
      events: [
        {
          ...o('rx', '2026-09-01', ''),
          kind: 'prescription' as const,
          label: 'Metformin',
          detail: '500 mg · with dinner',
          dateRaw: '1 Sep',
        },
      ],
    },
  };
  const a = await ask('What dose is documented in the prescription?', [], r);
  expect(a.cards[0]?.detail).toBe('500 mg · with dinner');
  expect(a.message).toContain('does not confirm');
  for (const q of [
    'Should I take more insulin?',
    'Is my HbA1c normal?',
    'Show HbA1c and recommend treatment',
    'Did it improve?',
  ]) {
    const b = await ask(q, [], r);
    expect(b.cards).toEqual([]);
    expect(b.message).toContain('cannot diagnose');
  }
  const home = await ask('Show home readings');
  expect(home.cards).toEqual([]);
  expect(home.message).toContain('illustrative dashboard chart is separate');
});
it('does not select another test for unknown names or label a generic result previous', async () => {
  expect((await ask('What is my creatinine result?')).cards).toEqual([]);
  const a = await ask('Show the previous result');
  expect(a.cards).toEqual([]);
  expect(a.message).toContain('name');
});
async function provider(plan: unknown, delay = 0) {
  let calls = 0,
    body: Record<string, unknown> = {};
  listener = createServer((req, res) => {
    calls++;
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      body = JSON.parse(data);
      setTimeout(() => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    typeof plan === 'string' ? plan : JSON.stringify(plan),
                },
              },
            ],
          }),
        );
      }, delay);
    });
  });
  await new Promise<void>((r) => listener!.listen(0, '127.0.0.1', r));
  const address = listener.address();
  if (!address || typeof address === 'string') throw Error();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    calls: () => calls,
    body: () => body,
  };
}
it('uses Luna to resolve a natural question but sends no patient records or identity', async () => {
  const p = await provider({
    kind: 'measurements',
    testCode: 'hba1c',
    selection: 'history',
    term: null,
  });
  const a = await createConversationService({
    ...config,
    mode: 'live',
    apiKey: 'synthetic',
    baseUrl: p.baseUrl,
  }).answer(
    question('Can you bring up the sugar marker?'),
    records,
    'clinician',
  );
  expect(a.mode).toBe('live');
  expect(a.cards.length).toBe(3);
  expect(p.body()).toMatchObject({
    model: 'gpt-6-luna',
    reasoning_effort: 'none',
    max_completion_tokens: 300,
    store: false,
  });
  const sent = JSON.stringify(p.body());
  for (const secret of [
    'Synthetic Asha',
    '11111111-1111',
    '7.8%',
    '2026-10-03',
  ])
    expect(sent).not.toContain(secret);
});
it('rejects provider prose, unrecognized codes and extra instructions', async () => {
  const p = await provider({
    kind: 'measurements',
    testCode: 'hba1c',
    selection: 'latest',
    term: null,
    advice: 'Take insulin https://evil.test',
  });
  const a = await createConversationService({
    ...config,
    mode: 'live',
    apiKey: 'synthetic',
    baseUrl: p.baseUrl,
  }).answer(question('latest HbA1c'), records, 'patient');
  expect(a.mode).toBe('local');
  expect(a.cards[0]?.id).toBe('latest');
  expect(a.message).not.toContain('evil');
});
it('shares bounded call budget with navigation help and returns honest fallback', async () => {
  const p = await provider({
    kind: 'measurements',
    testCode: 'hba1c',
    selection: 'latest',
    term: null,
  });
  const live = {
    ...config,
    mode: 'live' as const,
    apiKey: 'synthetic',
    baseUrl: p.baseUrl,
    budget: createGuideBudget(1, 2),
  };
  await createConversationService(live).answer(
    question('latest HbA1c'),
    records,
    'patient',
  );
  const guide = await createGuideService(live).answer({
    message: 'upload',
    screen: 'records',
    role: 'patient',
  });
  expect(guide.mode).toBe('local');
  expect(p.calls()).toBe(1);
});
it('times out without fabricating a live answer', async () => {
  const p = await provider(
    { kind: 'summary', testCode: null, selection: 'latest', term: null },
    80,
  );
  const a = await createConversationService({
    ...config,
    mode: 'live',
    apiKey: 'synthetic',
    baseUrl: p.baseUrl,
    timeoutMs: 10,
  }).answer(question('summary'), records, 'patient');
  expect(a.mode).toBe('local');
});
it('filters an explicit year without inventing dates for undated entries', async () => {
  const r = {
    ...records,
    timeline: {
      ...records.timeline,
      observations: [
        o('new', '2026-10-03', '7.8'),
        o('old', '2025-10-03', '8.3'),
        o('unknown', null, '9.0'),
      ],
    },
  };
  const a = await ask('Show HbA1c history in 2025', [], r);
  expect(a.cards.map((c) => c.id)).toEqual(['old']);
  expect(a.scopeNote).toContain('2025-01-01');
  const b = await ask(
    'Show the source for that result',
    ['Show HbA1c history in 2025'],
    r,
  );
  expect(b.cards.map((c) => c.id)).toEqual(['old']);
});
it('blocks clinical requests before using provider budget', async () => {
  const p = await provider({
    kind: 'summary',
    testCode: null,
    selection: 'latest',
    term: null,
  });
  const a = await createConversationService({
    ...config,
    mode: 'live',
    apiKey: 'synthetic',
    baseUrl: p.baseUrl,
  }).answer(question('Please recommend a treatment'), records, 'patient');
  expect(a.cards).toEqual([]);
  expect(p.calls()).toBe(0);
});
it('does not trust an unknown provider test code', async () => {
  const p = await provider({
    kind: 'measurements',
    testCode: 'fabricated',
    selection: 'latest',
    term: null,
  });
  const a = await createConversationService({
    ...config,
    mode: 'live',
    apiKey: 'synthetic',
    baseUrl: p.baseUrl,
  }).answer(question('latest HbA1c'), records, 'patient');
  expect(a.mode).toBe('local');
  expect(a.cards[0]?.detail).toBe('7.8 %');
});
it('does not invent chronological order between same-day results', async () => {
  const r = {
    ...records,
    timeline: {
      ...records.timeline,
      observations: [
        o('one', '2026-10-03', '7.8'),
        o('two', '2026-10-03', '7.9'),
        o('earlier', '2026-08-01', '8.1'),
      ],
    },
  };
  const a = await ask('latest HbA1c', [], r);
  expect(a.cards.map((c) => c.id)).toEqual(['one', 'two']);
  expect(a.message).toContain('same date');
  const b = await ask('previous HbA1c', [], r);
  expect(b.cards.map((c) => c.id)).toEqual(['earlier']);
});
it('asks for a valid date instead of interpreting an impossible one', async () => {
  const a = await ask('HbA1c history on 2026-02-30');
  expect(a.cards).toEqual([]);
  expect(a.message).toContain('valid calendar date');
});
it('highlights the value evidence rather than an unrelated date span when available', async () => {
  const latest = {
    ...records.timeline.observations[0]!,
    evidence: [
      {
        evidenceId: 'date',
        documentVersionId: 'version',
        page: 1,
        quote: 'Collected: 3 October 2026',
        bbox: null,
        origin: 'pdf_text' as const,
      },
      ...records.timeline.observations[0]!.evidence,
    ],
  };
  const r = {
    ...records,
    timeline: { ...records.timeline, observations: [latest] },
  };
  const a = await ask('latest HbA1c', [], r);
  expect(a.cards[0]?.source?.quote).toBe('HbA1c 7.8%');
});
it('retains a timezone on a submission timestamp instead of inventing a date-only event', async () => {
  const r = {
    ...records,
    timeline: {
      ...records.timeline,
      notes: [
        {
          noteId: 'note',
          category: 'other',
          body: 'Synthetic evening note',
          eventDate: null,
          submittedAt: '2026-10-03T21:09:17.000Z',
          authorRole: 'patient' as const,
          seenBy: null,
          seenAt: null,
          supersedesNoteId: null,
          version: 1,
        },
      ],
      noteTotal: 1,
    },
  };
  const a = await ask('What notes were reported?', [], r);
  expect(a.cards[0]?.date).toBeNull();
  expect(a.cards[0]?.dateLabel).toContain('2026-10-03T21:09:17.000Z');
});
