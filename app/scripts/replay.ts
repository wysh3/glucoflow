import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { appRoot } from './lib/env';

/**
 * The replay turns a cohort of reports into two numbers: what happened, and what
 * the closure state machine would have done with the same staff capacity.
 *
 * This is not a clinical trial. It is a retrospective baseline plus a deterministic
 * queue simulation. The source is labelled in the output, and the screen that reads
 * it must show the label. Replace the synthetic cohort with the 300-report audit
 * before the finale.
 */

type Flag = 'critical' | 'abnormal' | 'normal';
type CohortRow = {
  ref: string;
  flag: Flag;
  outpatient: boolean;
  receivedAt: string;
  acknowledgedAt: string | null;
  informedAt: string | null;
};

type Summary = {
  unacknowledgedShare: number;
  uninformedShare: number;
  medianHandoffMinutes: number | null;
  outpatientUnacknowledgedShare: number;
  criticalUnacknowledgedShare: number;
  closedWithinSlaShare: number;
};

type Replay = {
  generatedAt: string;
  source: 'synthetic' | 'audit';
  cohort: number;
  windowDays: number;
  baseline: Summary;
  intervention: {
    closedWithinSlaShare: number;
    medianHandoffMinutes: number | null;
    informedShare: number;
    exceptionShare: number;
  };
  assumptions: string[];
};

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function logNormalMinutes(random: () => number, median: number, sigma: number): number {
  const u = Math.max(0.0001, random());
  const v = Math.max(0.0001, random());
  const normal = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.round(median * Math.exp(sigma * normal));
}

function iso(base: Date, minutes: number): string {
  return new Date(base.getTime() + minutes * 60_000).toISOString();
}

function buildSyntheticCohort(seed: number, count: number): CohortRow[] {
  const random = rng(seed);
  const base = new Date('2026-10-06T08:00:00.000Z');
  const rows: CohortRow[] = [];
  for (let index = 0; index < count; index += 1) {
    const flag: Flag = random() < 0.08 ? 'critical' : random() < 0.58 ? 'abnormal' : 'normal';
    const outpatient = random() < 0.6;
    const day = Math.floor(random() * 30);
    const minuteOfDay = 8 * 60 + Math.floor(random() * 600);
    const received = day * 1440 + minuteOfDay;

    const ackBase = flag === 'critical' ? 0.66 : flag === 'abnormal' ? 0.58 : 0.93;
    const ackProbability = Math.min(0.97, Math.max(0.15, ackBase - (outpatient ? 0.14 : 0)));
    const acknowledged = random() < ackProbability;
    const ackMedian = flag === 'critical' ? 24 : flag === 'abnormal' ? 105 : 45;
    const ackDelay = acknowledged ? Math.max(3, logNormalMinutes(random, ackMedian, 0.85)) : 0;
    const informed = acknowledged && random() < 0.58;
    const informDelay = informed ? Math.max(5, logNormalMinutes(random, 95, 0.9)) : 0;

    rows.push({
      ref: `REPLAY-${String(index + 1).padStart(4, '0')}`,
      flag,
      outpatient,
      receivedAt: iso(base, received),
      acknowledgedAt: acknowledged ? iso(base, received + ackDelay) : null,
      informedAt: informed ? iso(base, received + ackDelay + informDelay) : null,
    });
  }
  return rows;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
    : sorted[middle]!;
}

function minutesBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 60_000);
}

function slaMinutes(flag: Flag): number {
  return flag === 'critical' ? 60 : 1440;
}

function summarise(rows: CohortRow[]): Summary {
  const acknowledged = rows.filter((row) => row.acknowledgedAt !== null);
  const informedOnTime = rows.filter(
    (row) => row.informedAt !== null && minutesBetween(row.receivedAt, row.informedAt) <= slaMinutes(row.flag),
  );
  const outpatients = rows.filter((row) => row.outpatient);
  const criticals = rows.filter((row) => row.flag === 'critical');

  return {
    unacknowledgedShare: round(1 - acknowledged.length / rows.length),
    uninformedShare: round(1 - rows.filter((row) => row.informedAt !== null).length / rows.length),
    medianHandoffMinutes: median(
      acknowledged.map((row) => minutesBetween(row.receivedAt, row.acknowledgedAt!)),
    ),
    outpatientUnacknowledgedShare: round(
      1 - outpatients.filter((row) => row.acknowledgedAt !== null).length / Math.max(1, outpatients.length),
    ),
    criticalUnacknowledgedShare: round(
      1 - criticals.filter((row) => row.acknowledgedAt !== null).length / Math.max(1, criticals.length),
    ),
    closedWithinSlaShare: round(informedOnTime.length / rows.length),
  };
}

function simulate(rows: CohortRow[]): Replay['intervention'] {
  const random = rng(20261104);
  const order = [...rows].sort((left, right) => {
    const leftDue = Date.parse(left.receivedAt) + slaMinutes(left.flag) * 60_000;
    const rightDue = Date.parse(right.receivedAt) + slaMinutes(right.flag) * 60_000;
    return leftDue - rightDue;
  });

  const deskMinutes = 4;
  const reviewMinutes = 6;
  const callMinutes = 4;
  const reachProbability = 0.86;
  let nurseFreeAt = 0;
  let closed = 0;
  let informed = 0;
  let exceptions = 0;
  const handoffs: number[] = [];

  for (const row of order) {
    const received = Date.parse(row.receivedAt);
    const seen = received + deskMinutes * 60_000 + reviewMinutes * 60_000;
    const callStart = Math.max(seen, nurseFreeAt);
    nurseFreeAt = callStart + callMinutes * 60_000;
    handoffs.push(Math.round((seen - received) / 60_000));

    if (random() < reachProbability) {
      informed += 1;
      const informedAt = callStart + 2 * 60_000;
      if (informedAt - received <= slaMinutes(row.flag) * 60_000) closed += 1;
    } else {
      exceptions += 1;
    }
  }

  return {
    closedWithinSlaShare: round(closed / rows.length),
    medianHandoffMinutes: median(handoffs),
    informedShare: round(informed / rows.length),
    exceptionShare: round(exceptions / rows.length),
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function parseCsv(text: string): CohortRow[] {
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift()?.split(',').map((cell) => cell.trim()) ?? [];
  const index = (name: string): number => header.indexOf(name);
  const required = ['ref', 'flag', 'outpatient', 'received_at'];
  for (const column of required) {
    if (index(column) === -1) throw new Error(`CSV is missing the ${column} column.`);
  }
  return lines.map((line) => {
    const cells = line.split(',').map((cell) => cell.trim());
    const flag = cells[index('flag')] as Flag;
    if (!['critical', 'abnormal', 'normal'].includes(flag)) {
      throw new Error(`Unknown flag in row: ${line}`);
    }
    return {
      ref: cells[index('ref')]!,
      flag,
      outpatient: cells[index('outpatient')] === 'true',
      receivedAt: new Date(cells[index('received_at')]!).toISOString(),
      acknowledgedAt: cells[index('acknowledged_at')]
        ? new Date(cells[index('acknowledged_at')]!).toISOString()
        : null,
      informedAt: cells[index('informed_at')]
        ? new Date(cells[index('informed_at')]!).toISOString()
        : null,
    };
  });
}

function main(): void {
  const inputIndex = process.argv.indexOf('--input');
  const input = inputIndex === -1 ? null : process.argv[inputIndex + 1];
  const cohort = input ? parseCsv(readFileSync(input, 'utf8')) : buildSyntheticCohort(20261104, 300);
  const baseline = summarise(cohort);
  const intervention = simulate(cohort);

  const replay: Replay = {
    generatedAt: new Date().toISOString(),
    source: input ? 'audit' : 'synthetic',
    cohort: cohort.length,
    windowDays: 30,
    baseline,
    intervention,
    assumptions: [
      'Baseline is the recorded acknowledgement and communication on the cohort.',
      'Intervention is a deterministic queue simulation, not a controlled trial.',
      'Desk accepts custody in 4 minutes; clinician review adds 6 minutes.',
      'One nurse, 4 minutes per call, 86% reachability, two attempts before an exception.',
      'Critical SLA is 60 minutes; abnormal SLA is 24 hours.',
    ],
  };

  const output = join(appRoot, 'apps', 'client', 'src', 'features', 'clinic', 'replay', 'replay-data.json');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(replay, null, 2)}\n`);

  console.log(`cohort ${replay.cohort} · source ${replay.source}`);
  console.log(`baseline   unacknowledged ${(baseline.unacknowledgedShare * 100).toFixed(1)}% · median handoff ${baseline.medianHandoffMinutes} min · closed in SLA ${(baseline.closedWithinSlaShare * 100).toFixed(1)}%`);
  console.log(`intervention closed in SLA ${(intervention.closedWithinSlaShare * 100).toFixed(1)}% · median handoff ${intervention.medianHandoffMinutes} min · exceptions ${(intervention.exceptionShare * 100).toFixed(1)}%`);
  console.log(`wrote ${output}`);
}

main();
