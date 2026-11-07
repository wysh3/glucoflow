import type { CareApplicableSkill, CareChatResult, CareLanguageCode, CareRuntimeStatus, CareWorkspace } from '@glucoflow/contracts';
import { z } from 'zod';
import { ApiError } from '../errors';
import { readCareRuntimeStream, type CareProgressStage } from './progress';
import { readBoundedJson, readHermesBridgeConfig } from '../hermes/bridge';
import { feedIsFresh, latestAcknowledgement, latestEvent, orderEvents } from './events';
import { activePlaybook } from './playbooks';
import { playbookSchema, runtimeChatResponse, runtimeHealthResponse } from './schema';

const version = '0.23.0';
const maxRequestBytes = 128 * 1024;
const maxResponseBytes = 64 * 1024;
const maxConcurrent = 4;
const clinicalQuestion = /\b(?:diagnos(?:e|is|tic)|dosage|dosing|triage|risk score|clinical urgency)\b|\b(?:give|start|stop|increase|decrease|change|recommend|adjust|what dose)\b[^.!?]{0,55}\b(?:insulin|medication|treatment|dialysis|fluids|dose)\b/i;
const durationMs = z.number().int().nonnegative().max(65_000);
const timingSchema = z.strictObject({
  startupMs: durationMs.optional(),
  loopMs: durationMs.optional(),
  providerMs: durationMs.optional(),
  toolMs: durationMs.optional(),
  workerMs: durationMs.optional(),
  providerCalls: z.number().int().min(0).max(3).optional(),
});
type BridgeTiming = {
  bridgeMs: number;
  httpStatus: number | null;
  runtime: z.infer<typeof timingSchema> | null;
};

function runtimeUnavailable() {
  return new ApiError(503, 'hermes_unavailable', 'Gluco is unavailable. Try again or explicitly select the deterministic helper.');
}

function invalidRuntimeResponse() {
  return new ApiError(502, 'hermes_invalid_response', 'Gluco returned a response that could not be verified against this workspace.');
}

function readTiming(header: string | null): BridgeTiming['runtime'] {
  if (!header || header.length > 512) return null;
  try {
    const timing = timingSchema.safeParse(JSON.parse(header));
    return timing.success ? timing.data : null;
  } catch {
    return null;
  }
}

function validateChatReferences(
  state: CareWorkspace, result: CareChatResult, applicableSkills: readonly CareApplicableSkill[],
): void {
  if (!result.sources.every((id) => state.events.some((event) => event.id === id))) throw invalidRuntimeResponse();
  const skillEvidence = new Set<string>();
  for (const proposal of result.proposals) {
    if (proposal.encounterId && !state.encounters.some((item) => item.id === proposal.encounterId)) {
      throw invalidRuntimeResponse();
    }
    if (proposal.kind === 'monitor') {
      if (!proposal.encounterId || !proposal.orderId ||
          !state.orders.some((order) => order.id === proposal.orderId && order.encounterId === proposal.encounterId)) {
        throw invalidRuntimeResponse();
      }
      if (proposal.skillId) {
        const skill = applicableSkills.find((item) => item.id === proposal.skillId &&
          item.encounterId === proposal.encounterId && item.orderId === proposal.orderId && item.pattern === proposal.body);
        if (!skill) throw invalidRuntimeResponse();
        const events = orderEvents(state, skill.encounterId, skill.orderId);
        const evidence = skill.pattern === 'specimen_receipt'
          ? latestEvent(events, 'specimen_collected')
          : latestEvent(events, 'result_validated', 'result_corrected');
        if (!evidence || !result.sources.includes(evidence.id)) throw invalidRuntimeResponse();
        skillEvidence.add(evidence.id);
      }
    } else if (proposal.orderId) {
      throw invalidRuntimeResponse();
    }
    if (proposal.skillId && proposal.kind !== 'monitor') throw invalidRuntimeResponse();
    if (proposal.kind === 'playbook') {
      try {
        if (proposal.encounterId) throw invalidRuntimeResponse();
        playbookSchema.parse(JSON.parse(proposal.body ?? ''));
      } catch {
        throw invalidRuntimeResponse();
      }
    }
  }
  if (skillEvidence.size && result.sources.some((id) => !skillEvidence.has(id))) throw invalidRuntimeResponse();
}

export function createHermesBridge(onTiming?: (timing: BridgeTiming) => void) {
  const config = readHermesBridgeConfig();
  const active = new Set<string>();

  return {
    async health(): Promise<CareRuntimeStatus> {
      const unavailable: CareRuntimeStatus = {
        available: false, configured: config !== null, engine: 'hermes', model: null, version,
      };
      if (!config) return unavailable;
      try {
        const response = await fetch(new URL('/health', config.url), {
          redirect: 'error', signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) {
          await response.body?.cancel().catch(() => undefined);
          return unavailable;
        }
        const status = runtimeHealthResponse.safeParse(await readBoundedJson(response, maxResponseBytes));
        return status.success ? { ...status.data, available: status.data.available && status.data.configured } : unavailable;
      } catch {
        return unavailable;
      }
    },
    async chat(
      state: CareWorkspace, message: string, requestId: string, applicableSkills: CareApplicableSkill[] = [],
      languageCode: CareLanguageCode = 'en-IN', cancellation?: AbortSignal, onProgress?: (stage: CareProgressStage) => void,
    ): Promise<CareChatResult> {
      const cancelled = () => new ApiError(499, 'chat_cancelled', 'Reply stopped. No proposal was saved.');
      if (cancellation?.aborted) throw cancelled();
      if (!config) throw runtimeUnavailable();
      if (active.has(state.id)) throw ApiError.conflict('A Gluco reply is already pending in this workspace.', 'chat_in_progress');
      if (active.size >= maxConcurrent) throw ApiError.rateLimited('Gluco is busy. Try again shortly.');

      const payload = JSON.stringify({
        message, requestId,
        ...(languageCode === 'en-IN' ? {} : { languageCode }),
        workspace: { ...state, activity: [], messages: [], playbooks: [activePlaybook(state)], applicableSkills },
        history: state.messages.slice(-8).map(({ role, content }) => ({ role, content })),
      });
      if (Buffer.byteLength(payload, 'utf8') > maxRequestBytes) {
        throw ApiError.tooLarge('This simulation exceeds the Gluco context size. The deterministic helper remains available.');
      }
      active.add(state.id);
      const started = performance.now();
      let httpStatus: number | null = null;
      let runtime: BridgeTiming['runtime'] = null;
      try {
        const deadline = AbortSignal.timeout(65_000);
        const signal = cancellation ? AbortSignal.any([deadline, cancellation]) : deadline;
        const response = await fetch(new URL('/chat', config.url), {
          method: 'POST', redirect: 'error', signal,
          headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json', ...(onProgress ? { accept: 'application/x-ndjson' } : {}) },
          body: payload,
        });
        httpStatus = response.status;
        runtime = readTiming(response.headers.get('x-hermes-timing'));
        let streamed: Awaited<ReturnType<typeof readCareRuntimeStream>> | undefined;
        if (response.ok && onProgress && response.headers.get('content-type')?.startsWith('application/x-ndjson')) {
          streamed = await readCareRuntimeStream(response, onProgress);
          httpStatus = streamed.status;
          const measured = timingSchema.safeParse(streamed.timing);
          runtime = measured.success ? measured.data : null;
        }
        const status = streamed?.status ?? response.status;
        if (status !== 200) {
          await response.body?.cancel().catch(() => undefined);
          if (status === 429) throw ApiError.rateLimited('Gluco is busy or its provider budget was reached. Try again later.');
          if (status === 504) throw new ApiError(504, 'hermes_timeout', 'Gluco took too long to reply. Try again.');
          if (status === 422) throw invalidRuntimeResponse();
          throw runtimeUnavailable();
        }

        let body: unknown;
        try {
          body = streamed ? streamed.payload : await readBoundedJson(response, maxResponseBytes);
        } catch {
          if (cancellation?.aborted) throw cancelled();
          if (signal.aborted) throw new ApiError(504, 'hermes_timeout', 'Gluco took too long to reply. Try again.');
          throw invalidRuntimeResponse();
        }
        if (cancellation?.aborted) throw cancelled();
        onProgress?.('validating');
        const parsed = runtimeChatResponse.safeParse(body);
        if (!parsed.success) throw invalidRuntimeResponse();
        validateChatReferences(state, parsed.data, applicableSkills);
        return { ...parsed.data, languageCode: parsed.data.languageCode ?? 'en-IN' };
      } catch (error) {
        if (cancellation?.aborted) throw cancelled();
        if (error instanceof ApiError) throw error;
        if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
          throw new ApiError(504, 'hermes_timeout', 'Gluco took too long to reply. Try again.');
        }
        throw runtimeUnavailable();
      } finally {
        active.delete(state.id);
        // Telemetry cannot turn a verified answer into a failed/duplicated turn.
        try { onTiming?.({ bridgeMs: Math.round(performance.now() - started), httpStatus, runtime }); } catch { /* best effort */ }
      }
    },
  };
}

export function answerOffline(
  state: CareWorkspace, message: string, now: number, languageCode: CareLanguageCode = 'en-IN',
): CareChatResult {
  const query = message.toLowerCase();
  const words = new Set(query.split(/[^\p{L}\p{N}-]+/u));
  const result: CareChatResult = {
    engine: 'offline', languageCode: 'en-IN', sources: [], proposals: [],
    reply: `Deterministic helper · Synthetic workspace${languageCode === 'en-IN' ? '' : ' · English fallback'}\n\n`,
  };
  if (clinicalQuestion.test(message)) {
    result.reply += 'I can summarize documented source events and draft workflow actions for review. Your care team handles diagnosis, treatment and clinical urgency.';
    return result;
  }

  const encounters = state.encounters.filter((item) =>
    query.includes(item.patientName.toLowerCase()) || words.has(item.patientCode.toLowerCase()) ||
    item.patientName.toLowerCase().split(/\s+/).some((word) => word.length >= 3 && words.has(word)));
  if (encounters.length > 1) {
    result.reply += 'Several encounters match. Include an exact demo encounter code.';
    return result;
  }
  const encounter = encounters[0];
  if (/\b(?:playbook|format|layout|handover)\b/.test(query) && /\b(?:source|owner)[ -]first\b/.test(query)) {
    const order = /\bsource[ -]first\b/.test(query) ? 'source-first' : 'owner-first';
    result.reply += 'I prepared a handover formatting proposal. The new version requires simulator tests and human approval.';
    result.proposals.push({ kind: 'playbook', title: 'Handover display order', body: JSON.stringify({ handoverOrder: order }) });
    return result;
  }
  if (/\b(?:handover|hand off|shift summary)\b/.test(query)) {
    result.reply += 'I prepared a handover proposal for review. Open it to draft from the current approved playbook and linked source events.';
    result.proposals.push({ kind: 'handover', title: 'Draft shift handover', ...(encounter ? { encounterId: encounter.id } : {}) });
    return result;
  }

  const orders = state.orders.filter((order) => !encounter || order.encounterId === encounter.id);
  const namedOrders = orders.filter((order) => query.includes(order.testName.toLowerCase()) || words.has(order.specimenId.toLowerCase()));
  const scoped = namedOrders.length ? namedOrders : orders;
  if (/\bmonitor\b/.test(query)) {
    if (scoped.length !== 1) {
      result.reply += 'Include one demo encounter code or specimen ID to prepare a monitoring proposal.';
      return result;
    }
    const order = scoped[0]!;
    const events = orderEvents(state, order.encounterId, order.id);
    if (latestEvent(events, 'order_cancelled') || latestAcknowledgement(events)) {
      result.reply += 'The source record already shows cancellation or acknowledgement for that order.';
    } else if (latestEvent(events, 'specimen_received', 'result_validated', 'result_corrected')?.kind === 'specimen_received') {
      result.reply += 'The LIS already recorded specimen receipt. Result validation has not been recorded.';
    } else {
      const kind = latestEvent(events, 'result_validated', 'result_corrected') ? 'result_acknowledgement' : 'specimen_receipt';
      result.reply += 'I prepared a monitoring proposal for review and approval.';
      result.proposals.push({
        kind: 'monitor', encounterId: order.encounterId, orderId: order.id, body: kind,
        title: kind === 'specimen_receipt' ? 'Confirm specimen receipt' : 'Confirm result acknowledgement',
      });
    }
  } else {
    result.reply += `Showing ${Math.min(scoped.length, 6)} of ${scoped.length} matching synthetic orders and their latest recorded events.`;
  }

  const missing = (['HIS', 'LIS'] as const).filter((source) => !feedIsFresh(state, source, now));
  if (missing.length) result.reply += ` ${missing.join(' and ')} feed is disconnected or stale. Current source status is unknown.`;
  for (const order of scoped.slice(0, 6)) {
    const subject = state.encounters.find((item) => item.id === order.encounterId);
    const events = orderEvents(state, order.encounterId, order.id);
    const event = events.at(-1);
    if (!event) continue;
    result.reply += `\n• ${subject?.patientCode ?? 'Encounter'} · ${order.testName}: ${event.label} (${event.source} ${event.sourceRef}).`;
    result.sources.push(event.id);
  }
  return result;
}
