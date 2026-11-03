#!/usr/bin/env node
/**
 * Portable harness audit based on arXiv:2609.20804.
 * Input is a recorded trajectory summary, not live model output.
 */
import fs from 'node:fs';

const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

export function auditTrajectory(input = {}) {
  const contextBudget = Math.max(1, Number(input.contextBudgetTokens) || 128000);
  const contextUsed = Math.max(0, Number(input.contextUsedTokens) || 0);
  const ratio = contextUsed / contextBudget;
  const toolResultChars = Math.max(0, Number(input.largestToolResultChars) || 0);
  const identical = Math.max(0, Number(input.identicalCallStreak) || 0);
  const identicalFailing = Math.max(0, Number(input.identicalFailingStreak) || 0);
  const bashScore = clamp01(input.bashProficiency ?? 0.5);
  const capability = clamp01(input.modelCapability ?? 0.5);
  const plan = Boolean(input.planPresent);
  const diagnostics = Boolean(input.postEditDiagnostics);
  const warnings = [];
  const actions = [];

  if (ratio >= 0.85) {
    warnings.push('context_hard_threshold');
    actions.push('Elide stale tool observations, then summarize the oldest middle events before the next turn.');
  } else if (ratio >= 0.6) {
    warnings.push('context_soft_threshold');
    actions.push('Elide stale tool observations. Do not call summarization yet.');
  }
  if (toolResultChars > 24000) {
    warnings.push('tool_result_too_large');
    actions.push('Truncate the tool observation to 24k characters and keep a short stub.');
  }
  if (identical >= 5) {
    warnings.push('identical_call_streak');
    actions.push('Inject the paper-style reminder to change approach.');
  }
  if (identicalFailing >= 8) {
    warnings.push('identical_failure_streak');
    actions.push('Stop the run with a dedicated stuck reason instead of spending the step budget.');
  }
  if (!diagnostics) {
    warnings.push('missing_post_edit_diagnostics');
    actions.push('Run a fast syntax/type/lint check after each edit.');
  }
  if (!plan && capability < 0.6) {
    warnings.push('weak_model_without_plan');
    actions.push('Create a short persistent plan before the next action.');
  }
  if (plan && capability >= 0.8) {
    warnings.push('strong_model_long_plan');
    actions.push('Keep the plan short; use it as a cost guard, not a long scaffold.');
  }

  return {
    context: {
      ratio: Number(ratio.toFixed(3)),
      recommendation: ratio >= 0.85 ? 'elide_then_summarize' : ratio >= 0.6 ? 'elide' : 'keep',
    },
    planning: !plan && capability < 0.6 ? 'required' : capability >= 0.8 ? 'short' : 'optional',
    actionSpace: bashScore >= 0.7 ? 'bash-only' : 'predefined-tools',
    stuck: identicalFailing >= 8 ? 'stop' : identical >= 5 ? 'remind' : 'none',
    warnings,
    actions,
    evidence: 'arXiv:2609.20804v1, sections 2.3, 3.2, 7.4 and 9.5-9.6',
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: node scripts/harness-audit.mjs <trajectory.json>');
    process.exit(2);
  }
  const input = JSON.parse(fs.readFileSync(path, 'utf8'));
  process.stdout.write(JSON.stringify(auditTrajectory(input), null, 2) + '\n');
}
