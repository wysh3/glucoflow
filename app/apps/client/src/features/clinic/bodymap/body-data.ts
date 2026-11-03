import type {
  DeltaSummary,
  EvidenceDto,
  TimelineEvent,
  TimelineObservation,
  TimelineResult,
} from '@glucoflow/contracts';
import { formatDateOnly } from '@glucoflow/ui';

export type BodySystemKey = 'glucose' | 'eyes' | 'heart' | 'kidneys' | 'feet';
export type BodyStatus = 'recorded' | 'open' | 'conflict' | 'missing';
export type BodyItem = {
  id: string;
  title: string;
  detail: string;
  date: string | null;
  kind: 'observation' | 'event';
  source?: {
    documentId: string;
    versionId: string;
    page: number;
    quote: string;
    bbox: [number, number, number, number] | null;
  };
};
export type BodySystem = {
  key: BodySystemKey;
  label: string;
  caption: string;
  status: BodyStatus;
  items: BodyItem[];
  latestDate: string | null;
  marker: { x: number; y: number };
};

const DEFINITIONS: {
  key: BodySystemKey;
  label: string;
  caption: string;
  pattern: RegExp;
  marker: { x: number; y: number };
}[] = [
  {
    key: 'glucose',
    label: 'Glucose',
    caption: 'HbA1c and blood glucose readings',
    pattern: /hba1c|glucose|sugar/i,
    marker: { x: 240, y: 292 },
  },
  {
    key: 'eyes',
    label: 'Eyes',
    caption: 'Eye and retinal review records',
    pattern: /eye|retina|fundus|ophthalm/i,
    marker: { x: 240, y: 96 },
  },
  {
    key: 'heart',
    label: 'Heart and vessels',
    caption: 'Blood pressure, lipids, ECG and cardiovascular review',
    pattern: /systolic|diastolic|blood pressure|cholesterol|ldl|hdl|triglyceride|ecg|cardiovascular|heart/i,
    marker: { x: 198, y: 238 },
  },
  {
    key: 'kidneys',
    label: 'Kidneys',
    caption: 'eGFR, creatinine and urine albumin records',
    pattern: /egfr|creatinine|urine acr|albumin|kidney/i,
    marker: { x: 286, y: 336 },
  },
  {
    key: 'feet',
    label: 'Feet',
    caption: 'Foot and neuropathy examination records',
    pattern: /foot|feet|neuropath|monofilament|podo/i,
    marker: { x: 240, y: 696 },
  },
];

function sourceOf(
  evidence: EvidenceDto[],
  documentId: string,
): BodyItem['source'] {
  const first = evidence[0];
  if (!first) return undefined;
  return {
    documentId,
    versionId: first.documentVersionId,
    page: first.page,
    quote: first.quote,
    bbox: first.bbox,
  };
}

function observationItem(o: TimelineObservation): BodyItem {
  return {
    id: o.factId,
    title: o.displayName,
    detail: [o.numericValue ?? o.rawValue, o.unit ?? o.rawUnit]
      .filter((value) => value !== null && value !== '')
      .join(' '),
    date: o.date,
    kind: 'observation',
    source: sourceOf(o.evidence, o.documentId),
  };
}

function eventItem(e: TimelineEvent): BodyItem {
  return {
    id: e.factId,
    title: e.label,
    detail: e.detail ?? 'Recorded examination',
    date: e.date,
    kind: 'event',
    source: sourceOf(e.evidence, e.documentId),
  };
}

const dateValue = (date: string | null): number =>
  date ? Date.parse(`${date}T00:00:00Z`) : 0;

export function buildBodySystems(
  timeline: TimelineResult | undefined,
  delta: DeltaSummary | undefined,
): BodySystem[] {
  const observations = timeline?.observations ?? [];
  const events = timeline?.events ?? [];
  return DEFINITIONS.map((definition) => {
    const items = [
      ...observations
        .filter((o) => definition.pattern.test(`${o.displayName} ${o.testCode}`))
        .map(observationItem),
      ...events
        .filter((e) => definition.pattern.test(`${e.label} ${e.detail ?? ''}`))
        .map(eventItem),
    ]
      .filter(
        (item, index, all) =>
          all.findIndex((other) => other.id === item.id) === index,
      )
      .sort((a, b) => dateValue(b.date) - dateValue(a.date));
    const conflict =
      delta?.blocks.conflict.some((item) => definition.pattern.test(item.title)) ??
      false;
    const open =
      delta?.blocks.unresolved.some((item) => definition.pattern.test(item.title)) ??
      false;
    const status: BodyStatus = conflict
      ? 'conflict'
      : open
        ? 'open'
        : items.length
          ? 'recorded'
          : 'missing';
    return {
      ...definition,
      status,
      items: items.slice(0, 6),
      latestDate: items[0]?.date ?? null,
    };
  });
}

const STATUS_LABEL: Record<BodyStatus, string> = {
  recorded: 'Recorded',
  open: 'Open review',
  conflict: 'Two sources disagree',
  missing: 'Not in this record',
};

const STATUS_COLOR: Record<BodyStatus, string> = {
  recorded: '#176b46',
  open: '#a85b00',
  conflict: '#b42318',
  missing: '#7b8d87',
};

const STATUS_FILL: Record<BodyStatus, string> = {
  recorded: '#e9f7ef',
  open: '#fff4e5',
  conflict: '#fff1f0',
  missing: '#f1f5f3',
};

export function systemStatusLabel(status: BodyStatus): string {
  return STATUS_LABEL[status];
}

export function systemStatusColor(status: BodyStatus): string {
  return STATUS_COLOR[status];
}

export function formatRecordedDate(date: string | null): string {
  return date ? formatDateOnly(date) : 'No date recorded';
}
