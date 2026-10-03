import { expect, it } from 'vitest';
import { collectTimelinePages } from './timeline-loading';
import { buildTimeline } from './timeline';
import type {
  TimelineResult,
  TimelineObservation,
  TimelineNote,
} from '@sutra/contracts';

it('loads independent cursors and marks observations complete only after every page', async () => {
  const blank = buildTimeline(
    { observations: [], events: [], notes: [] },
    { testCodes: [] },
    {
      observationCount: 101,
      eventCount: 0,
      noteCount: 2,
      latestReportDate: null,
      awaitingReviewCount: 0,
      sourceOnlyCount: 0,
    },
  );
  const observation = (id: string) =>
    ({ factId: id, testCode: 'hba1c', unit: '%' }) as TimelineObservation;
  const calls: unknown[] = [];
  const result = await collectTimelinePages(async (cursors) => {
    calls.push(cursors);
    return {
      ...blank,
      observations: cursors.cursor
        ? [observation('last')]
        : Array.from({ length: 100 }, (_, i) => observation(String(i))),
      notes: [
        { noteId: cursors.notesCursor ? 'note-2' : 'note-1' } as TimelineNote,
      ],
      nextCursor: cursors.cursor ? null : 'obs-page-2',
      notesNextCursor: cursors.notesCursor ? null : 'notes-page-2',
      eventsNextCursor: null,
    } as TimelineResult;
  });
  expect(result.observations).toHaveLength(101);
  expect(result.notes).toHaveLength(2);
  expect(result.observationsComplete).toBe(true);
  expect(calls).toHaveLength(2);
});
it('refuses a repeating cursor instead of presenting partial progression', async () => {
  const blank = buildTimeline(
    { observations: [], events: [], notes: [] },
    { testCodes: [] },
    {
      observationCount: 101,
      eventCount: 0,
      noteCount: 0,
      latestReportDate: null,
      awaitingReviewCount: 0,
      sourceOnlyCount: 0,
    },
  );
  await expect(
    collectTimelinePages(async () => ({ ...blank, nextCursor: 'same' })),
  ).rejects.toThrow(/cursor/i);
});

it('refuses history assembled across different publication revisions', async () => {
  const blank = buildTimeline(
    { observations: [], events: [], notes: [] },
    { testCodes: [] },
    {
      observationCount: 2,
      eventCount: 0,
      noteCount: 0,
      latestReportDate: null,
      awaitingReviewCount: 0,
      sourceOnlyCount: 0,
    },
  );
  let call = 0;
  await expect(
    collectTimelinePages(async () => ({
      ...blank,
      snapshotRevision: ++call,
      nextCursor: call === 1 ? 'next' : null,
    })),
  ).rejects.toThrow(/changed/);
});
