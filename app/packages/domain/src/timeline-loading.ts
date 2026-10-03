import { TIMELINE_DISPLAY_BOUND, type TimelineResult } from '@sutra/contracts';

export type TimelineCursors = {
  cursor?: string;
  eventsCursor?: string;
  notesCursor?: string;
};

/** Assemble all independently paged lanes before exposing a chart to the client. */
export async function collectTimelinePages<
  T extends TimelineResult & { snapshotRevision?: number },
>(fetchPage: (cursors: TimelineCursors) => Promise<T>): Promise<T> {
  let cursors: TimelineCursors = {};
  let first: T | undefined;
  const observations = new Map<string, T['observations'][number]>();
  const events = new Map<string, T['events'][number]>();
  const notes = new Map<string, T['notes'][number]>();
  const seen = new Set<string>();
  const finishedCursor = btoa(String(TIMELINE_DISPLAY_BOUND)).replace(
    /=+$/,
    '',
  );
  for (let page = 0; page < TIMELINE_DISPLAY_BOUND; page++) {
    const key = JSON.stringify(cursors);
    if (seen.has(key))
      throw new Error('Repeated timeline cursor; refresh the record.');
    seen.add(key);
    const result = await fetchPage(cursors);
    first ??= result;
    if (
      result.snapshotRevision !== first.snapshotRevision ||
      result.coverage.observationCount !== first.coverage.observationCount
    )
      throw new Error('Records changed while loading; refresh to continue.');
    result.observations.forEach((item) => observations.set(item.factId, item));
    result.events.forEach((item) => events.set(item.factId, item));
    result.notes.forEach((item) => notes.set(item.noteId, item));
    if (
      !result.nextCursor &&
      !result.eventsNextCursor &&
      !result.notesNextCursor
    ) {
      const units = new Map<
        string,
        { testCode: string; unit: string | null; count: number }
      >();
      for (const item of observations.values()) {
        const unitKey = `${item.testCode}|${item.unit ?? ''}`;
        const entry = units.get(unitKey) ?? {
          testCode: item.testCode,
          unit: item.unit,
          count: 0,
        };
        entry.count++;
        units.set(unitKey, entry);
      }
      return {
        ...first,
        observations: [...observations.values()].slice(
          0,
          TIMELINE_DISPLAY_BOUND,
        ),
        events: [...events.values()].slice(0, TIMELINE_DISPLAY_BOUND),
        notes: [...notes.values()].slice(0, TIMELINE_DISPLAY_BOUND),
        unitsInUse: [...units.values()],
        nextCursor: null,
        eventsNextCursor: null,
        notesNextCursor: null,
        observationsComplete:
          observations.size >= first.coverage.observationCount &&
          !first.coverage.truncated,
      };
    }
    cursors = {
      cursor: result.nextCursor ?? finishedCursor,
      eventsCursor: result.eventsNextCursor ?? finishedCursor,
      notesCursor: result.notesNextCursor ?? finishedCursor,
    };
  }
  throw new Error('Timeline page limit reached; narrow the date range.');
}
