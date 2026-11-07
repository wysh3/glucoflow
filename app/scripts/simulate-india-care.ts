/** Synthetic assumption study, not an India population estimate or network load test. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { CareCommand, CareEventKind, CareRole, CareTask, CareTaskStatus } from '@glucoflow/contracts';
import { seedCareWorkspace } from '../apps/api/src/care/seed';
import { executeCareCommand } from '../apps/api/src/care/commands';
import { reconcileCareWorkspace } from '../apps/api/src/care/monitor';

type Command = Exclude<CareCommand, { type: 'apply_skill' }>;
export interface Stratum { name: string; minArrivals: number; maxArrivals: number; outageProbability: number; maxReceiptDelayMinutes: number; cancellationProbability: number; correctionProbability: number; }
// Deliberately varied engineering stress assumptions, NOT national statistics or claims about these communities.
export const indiaStrata: Stratum[] = [
  { name: 'metro', minArrivals: 12, maxArrivals: 16, outageProbability: .15, maxReceiptDelayMinutes: 90, cancellationProbability: .08, correctionProbability: .12 },
  { name: 'tier2', minArrivals: 8, maxArrivals: 12, outageProbability: .30, maxReceiptDelayMinutes: 150, cancellationProbability: .10, correctionProbability: .15 },
  { name: 'tier3', minArrivals: 5, maxArrivals: 9, outageProbability: .45, maxReceiptDelayMinutes: 240, cancellationProbability: .12, correctionProbability: .18 },
  { name: 'rural', minArrivals: 3, maxArrivals: 7, outageProbability: .60, maxReceiptDelayMinutes: 360, cancellationProbability: .14, correctionProbability: .20 },
];
function generator(seed: number) {
  let value = seed >>> 0;
  return () => { value += 0x6D2B79F5; let n = value; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
export function runIndiaSimulation(seed: number, assumptions: Stratum, days = 90) {
  const rng = generator(seed);
  const recordedReceiptLags: number[] = [];
  const observedReceiptLags: number[] = [];
  const result = {
    seed, stratum: assumptions.name, days, arrivals: 0, commands: 0, checks: 0,
    sourceEvents: 0, duplicateNoops: 0, wrongRoleRejected: 0, wrongEncounterRejected: 0,
    outageWindows: 0, feedRetryRejections: 0, sourceSequenceRetries: 0, cancelledDeliveriesRejected: 0,
    corrections: 0, cancellations: 0, shiftAcceptances: 0, shiftRejections: 0,
    approvalWithheld: 0, pauses: 0, attestations: 0, expiryBoundaries: 0,
    collections: 0, collectionsWithReceipt: 0, collectionsWithoutReceipt: 0,
    receiptLagMinutes: { recordedMedian: null as number | null, recordedP95: null as number | null, observedMedian: null as number | null, observedP95: null as number | null },
    finalStatuses: {} as Record<string, number>, failures: [] as { day: number; minute: number; invariant: string }[],
  };
  for (let day = 0; day < days; day++) {
    const epoch = Date.UTC(2026, 0, 1 + day);
    const time = (minute: number) => new Date(epoch + minute * 60_000).toISOString();
    const state = seedCareWorkspace(new Date(epoch));
    // Empty synthetic starting cohort; retain the real approved default playbook.
    state.encounters = []; state.orders = []; state.events = []; state.tasks = []; state.activity = [];
    let minute = 0;
    let serial = 0;
    const queue: { minute: number; serial: number; run: () => void }[] = [];
    const schedule = (when: number, run: () => void) => queue.push({ minute: when, serial: serial++, run });
    const check = (condition: boolean, invariant: string) => {
      result.checks++;
      if (!condition) result.failures.push({ day: day + 1, minute, invariant });
    };
    const invariant = () => {
      for (const task of state.tasks) {
        if (task.status === 'source_confirmed') {
          const evidence = state.events.find((event) => event.id === task.completionEventId);
          check(Boolean(evidence && evidence.encounterId === task.encounterId && evidence.orderId === task.orderId), 'source completion must cite same encounter/order');
          check(Boolean(evidence && evidence.receivedAt < task.expiresAt), 'source completion requires receipt before expiry');
          check(state.activity.some((activity) => activity.taskId === task.id && activity.kind === 'task_approve'), 'source completion requires explicit human approval');
        } else check(task.completionEventId === null, 'non-source status has no completion evidence');
        if (task.status === 'human_attested') check(task.completionEventId === null, 'human attestation is not source evidence');
      }
    };
    const command = (cmd: Command) => {
      result.commands++;
      const changed = executeCareCommand(state, cmd, time(minute));
      reconcileCareWorkspace(state, time(minute));
      invariant();
      return changed;
    };
    const role = (value: CareRole) => command({ type: 'set_role', role: value });
    const rejected = (cmd: Command, label: string) => {
      const before = JSON.stringify(state);
      let threw = false;
      try { command(cmd); } catch { threw = true; }
      check(threw, `${label}: must reject`);
      check(JSON.stringify(state) === before, `${label}: rejected operation must not mutate state`);
      return threw;
    };
    // Feed heartbeats are explicit incoming synchronization, never imputed evidence.
    for (let tick = 10; tick <= 1080; tick += 10) schedule(tick, () => {
      for (const source of ['HIS', 'LIS'] as const) if (state.feeds[source].connected) command({ type: 'set_feed', source, connected: true });
    });
    for (const start of [80, 250]) if (rng() < assumptions.outageProbability) {
      const source = rng() < .5 ? 'HIS' as const : 'LIS' as const;
      const end = start + 30 + Math.floor(rng() * 100);
      result.outageWindows++;
      schedule(start, () => command({ type: 'set_feed', source, connected: false }));
      schedule(end, () => command({ type: 'set_feed', source, connected: true }));
    }
    const arrivals = assumptions.minArrivals + Math.floor(rng() * (assumptions.maxArrivals - assumptions.minArrivals + 1));
    for (let index = 0; index < arrivals; index++) {
      const arrival = Math.floor(rng() * 360);
      const receiptDelay = 10 + Math.floor(rng() * assumptions.maxReceiptDelayMinutes);
      const cancel = rng() < assumptions.cancellationProbability;
      const correct = !cancel && rng() < assumptions.correctionProbability;
      const withhold = rng() < .08;
      const pause = !withhold && rng() < .10;
      const attest = !withhold && !cancel && rng() < .05;
      const acceptShift = rng() < .8;
      const duration = rng() < .15 ? 30 : 240;
      schedule(arrival, () => {
        role('doctor');
        command({ type: 'add_encounter', patientName: `Synthetic ${assumptions.name} ${day + 1}-${index + 1}`, bed: `SIM-${index + 1}`, documentedContext: ['Synthetic operational test; no clinical recommendation.'] });
        const encounter = state.encounters.at(-1)!;
        // HIS outage admission/order attempt is deferred before mutation; disconnected add_order atomicity is independently probed below.
        const initialize = () => {
          if (!state.feeds.HIS.connected) { schedule(minute + 10, initialize); return; }
          role('doctor');
          command({ type: 'add_order', encounterId: encounter.id, testName: 'Synthetic laboratory panel', targetMinutes: 60 });
          const order = state.orders.at(-1)!;
          result.arrivals++;
          const start = minute;
          const tasks: CareTask[] = [];
          for (const kind of ['specimen_receipt', 'result_acknowledgement'] as const) {
            command({ type: 'create_task', encounterId: encounter.id, orderId: order.id, kind, title: `Synthetic ${kind}`, durationMinutes: duration });
            tasks.push(state.tasks.at(-1)!);
          }
          const receiptTask = tasks[0]!;
          const ackTask = tasks[1]!;
          if (withhold) result.approvalWithheld += 2;
          else for (const task of tasks) command({ type: 'task_action', taskId: task.id, action: 'approve' });
          role('nurse');
          if (rejected({ type: 'task_action', taskId: receiptTask.id, action: 'approve' }, 'wrong-role approval')) result.wrongRoleRejected++;
          if (rejected({ type: 'source_event', encounterId: '00000000-0000-4000-8000-000000000000', orderId: order.id, kind: 'specimen_collected', source: 'HIS', sourceRef: `WRONG-${index}` }, 'foreign encounter')) result.wrongEncounterRejected++;
          role('doctor');
          const owner = receiptTask.owner;
          const receivingLab = state.coordination!.staff.filter(person => person.role === 'lab')[index % 2]!;
          command({ type: 'request_transfer', taskId: receiptTask.id, recipientStaffId: receivingLab.id, reason: 'Synthetic shift change' });
          check(receiptTask.owner === owner, 'pending transfer retains current owner');
          rejected({ type: 'resolve_transfer', taskId: receiptTask.id, decision: 'accept' }, 'wrong-role transfer acceptance');
          command({ type: 'set_demo_staff', staffId: receivingLab.id });
          command({ type: 'resolve_transfer', taskId: receiptTask.id, decision: acceptShift ? 'accept' : 'reject' });
          check(receiptTask.status !== 'source_confirmed', 'shift transfer cannot complete task');
          check(acceptShift ? receiptTask.owner !== owner : receiptTask.owner === owner, 'transfer decision controls owner');
          if (acceptShift) result.shiftAcceptances++; else result.shiftRejections++;
          if (pause) {
            role('doctor'); command({ type: 'task_action', taskId: receiptTask.id, action: 'pause' }); result.pauses++;
            schedule(start + 20, () => { if (receiptTask.status === 'paused') { role('doctor'); command({ type: 'task_action', taskId: receiptTask.id, action: 'resume' }); } });
          }
          if (attest) { role('doctor'); command({ type: 'task_action', taskId: ackTask.id, action: 'attest', reason: 'Explicit synthetic staff attestation, not source confirmation' }); result.attestations++; }
          const emit = (kind: CareEventKind, source: 'HIS' | 'LIS', actor: CareRole, when: number, after?: () => void) => {
            const ref = `SIM-${day}-${index}-${kind}-${when}`;
            const deliver = () => {
              role(actor);
              const cmd: Command = { type: 'source_event', encounterId: encounter.id, orderId: order.id, kind, source, sourceRef: ref, occurredAt: time(when) };
              try {
                command(cmd); result.sourceEvents++;
                const before = state.events.length;
                check(command(cmd) === false && state.events.length === before, 'identical source redelivery is an idempotent no-op'); result.duplicateNoops++;
                after?.();
              } catch (error) {
                const code = (error as { code?: string }).code;
                if (code === 'order_cancelled') { result.cancelledDeliveriesRejected++; return; }
                if (code === 'feed_disconnected' || code === 'source_sequence_conflict') {
                  if (code === 'feed_disconnected') result.feedRetryRejections++; else result.sourceSequenceRetries++;
                  if (minute < start + 600) schedule(minute + 10, deliver);
                  else check(false, `source retry exhausted: ${kind}/${code}`);
                } else check(false, `unexpected source failure: ${kind}/${code ?? String(error)}`);
              }
            };
            schedule(when, deliver);
          };
          emit('specimen_collected', 'HIS', 'nurse', start + 2);
          if (cancel) emit('order_cancelled', 'HIS', 'doctor', start + 8, () => {
            result.cancellations++;
            check(tasks.every((task) => task.status === 'cancelled' || task.status === 'expired'), 'source cancellation closes associated tasks or preserves prior expiry');
          });
          emit('specimen_received', 'LIS', 'lab', start + receiptDelay);
          emit('result_validated', 'LIS', 'lab', start + receiptDelay + 10);
          emit('result_acknowledged', 'HIS', 'doctor', start + receiptDelay + 15, () => {
            if (correct) emit('result_corrected', 'LIS', 'lab', minute + 5, () => {
              result.corrections++;
              check(ackTask.status !== 'source_confirmed', 'correction invalidates prior acknowledgement');
              emit('result_acknowledged', 'HIS', 'doctor', minute + 5);
            });
          });
          schedule(start + duration, () => {
            reconcileCareWorkspace(state, time(minute)); invariant(); result.expiryBoundaries += 2;
            check(tasks.every((task) => !['monitoring', 'awaiting_evidence', 'awaiting_approval', 'paused'].includes(task.status)), 'exact expiry closes open monitoring');
          });
        };
        initialize();
      });
    }
    while (queue.length) {
      queue.sort((a, b) => a.minute - b.minute || a.serial - b.serial);
      const next = queue.shift()!; minute = next.minute;
      try { next.run(); } catch (error) { check(false, `unexpected scheduled failure: ${String(error)}`); }
    }
    minute = 1440;
    reconcileCareWorkspace(state, time(minute)); invariant();
    const stable = JSON.stringify(state);
    check(!reconcileCareWorkspace(state, time(minute)) && JSON.stringify(state) === stable, 'unchanged reconciliation is idempotent');
    check(state.encounters.length === arrivals, 'all scheduled arrivals created');
    for (const order of state.orders) {
      const collection = state.events.find((event) => event.orderId === order.id && event.kind === 'specimen_collected');
      if (!collection) continue;
      result.collections++;
      const receipt = state.events.find((event) => event.orderId === order.id && event.kind === 'specimen_received');
      if (receipt) {
        result.collectionsWithReceipt++;
        recordedReceiptLags.push((Date.parse(receipt.occurredAt) - Date.parse(collection.occurredAt)) / 60_000);
        observedReceiptLags.push((Date.parse(receipt.receivedAt) - Date.parse(collection.occurredAt)) / 60_000);
      } else result.collectionsWithoutReceipt++;
    }
    for (const task of state.tasks) result.finalStatuses[task.status] = (result.finalStatuses[task.status] ?? 0) + 1;
  }
  recordedReceiptLags.sort((a, b) => a - b);
  observedReceiptLags.sort((a, b) => a - b);
  const quantile = (values: number[], q: number) => values.length ? values[Math.max(0, Math.ceil(values.length * q) - 1)]! : null;
  result.receiptLagMinutes = { recordedMedian: quantile(recordedReceiptLags, .5), recordedP95: quantile(recordedReceiptLags, .95), observedMedian: quantile(observedReceiptLags, .5), observedP95: quantile(observedReceiptLags, .95) };
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const start = performance.now();
  const baseSeeds = [104729, 130363, 155921];
  const runs = indiaStrata.flatMap((stratum, index) => baseSeeds.map((seed) => runIndiaSimulation(seed + index * 1_000_000, stratum)));
  const seeds = runs.map((run) => run.seed);
  const report = {
    generatedAt: new Date().toISOString(), synthetic: true, scope: 'In-process actual care commands/events/reconciliation; 90 virtual days per run, daily bounded workspaces, no network, database, Hermes, clinical, adoption, or hospital throughput measurement.',
    reproducibility: 'Mulberry32 PRNG; seed controls arrivals/faults; random UUID values are deliberately excluded from aggregate outputs.',
    assumptions: indiaStrata, seeds, elapsedWallMs: Math.round(performance.now() - start), runs,
    totals: Object.fromEntries(['arrivals', 'commands', 'checks', 'sourceEvents', 'duplicateNoops', 'wrongRoleRejected', 'wrongEncounterRejected', 'outageWindows', 'feedRetryRejections', 'sourceSequenceRetries', 'cancelledDeliveriesRejected', 'corrections', 'cancellations', 'shiftAcceptances', 'shiftRejections', 'approvalWithheld', 'pauses', 'attestations', 'expiryBoundaries', 'collections', 'collectionsWithReceipt', 'collectionsWithoutReceipt'].map((key) => [key, runs.reduce((sum, run) => sum + Number(run[key as keyof typeof run]), 0)])),
    failureCount: runs.reduce((sum, run) => sum + run.failures.length, 0),
  };
  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/india-simulation-2026-11-07.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ totals: report.totals, failureCount: report.failureCount, elapsedWallMs: report.elapsedWallMs }, null, 2));
  if (report.failureCount) process.exitCode = 1;
}
