# Self-improving the coding harness

Applying arXiv:2609.20804 to the harness used for this build.

Paper: Run-Ze Fan et al., **An Empirical Study of Harness Design for Coding Agents**, arXiv:2609.20804v1, 17 September 2026.
Full text: https://arxiv.org/abs/2609.20804

## Scope

The paper is about the harness around a coding agent, not the application code. This note applies it to the harness used for this build in two ways:

1. A runnable **harness audit** (`scripts/harness-audit.mjs`) that turns the paper's rules into a pass/warn result for a recorded trajectory.
2. A concrete policy for the next harness change, with the measured trade-offs from the paper.

The same rules were used here: a persistent plan, structured read/search tools, shell only for bounded one-shot work, typecheck after edits, and a stopped review agent when it began repeating itself. No separate VT Code package was installed, so there is nothing to uninstall.

## What the paper measured

The study fixes the execution loop and varies planning, action space, and context management across four models and 176 matched settings on SWE-Bench Verified and Terminal-Bench 2.1.

| Finding | Evidence from the paper | Practical change |
|---|---|---|
| Context management matters most under a tight window | At 32k, context-managed tiers moved Nemotron-3 550B from 6.4% to 51.4-58.4% success; the gain shrinks as the window grows | Compact at **60%** of the usable window and summarize at **85%**. Do not wait for an overflow error. |
| Stage elision before summarization | Tier 4 (elide, then summarize) had the best efficiency; recall was rarely used and gave no accuracy gain | Keep a verbatim preamble and recent turns, elide stale tool output first, summarize only if still over the hard threshold. Do not build recoverable event storage by default. |
| Planning is capability-dependent | Removing planning cut Nemotron-3 30B from 25.2% to 13.6% on SWE-Bench, but raised Nemotron-3 550B from 65.8% to 67.8% while increasing cost/length | Plan for weaker or unfamiliar models. For strong models use a short plan as a cost guard, not a long scaffold. |
| Action space is capability-dependent | Bash-only cut Nemotron-3 550B cost from 2.33 to 1.11 dollars per task and raised success from 65.8% to 69.4%; it cut Nemotron-3 30B from 25.2% to 10.2% | Choose predefined tools for bash-weak models; choose bash-only for bash-capable models on command-line-heavy work. Do not make one interface global. |
| Stuck loops are a harness problem | The fixed substrate reminded after 5 identical calls and terminated after 8 identical failing calls | Detect byte-identical repeats; remind at 5, stop at 8 failing repeats. |
| Post-edit checks are cheap prevention | The fixed substrate appends fast diagnostics after writes | Run a syntax/type/lint check immediately after an edit, before a test turn. |

The paper's own limits matter: four models, two benchmarks, one harness implementation. These are transferable diagnostics, not universal constants.

## Proposed harness configuration

```json
{
  "context": {
    "softThreshold": 0.60,
    "hardThreshold": 0.85,
    "recentWindow": 0.30,
    "minRecentTurns": 2,
    "toolResultMaxChars": 24000,
    "elideBeforeSummarize": true,
    "recoverableElision": false
  },
  "planning": {
    "mode": "capability-aware",
    "weakModelPlan": true,
    "strongModelPlan": "short",
    "refreshPlanEveryTurn": true
  },
  "actionSpace": {
    "mode": "capability-aware",
    "bashWeak": "predefined-tools",
    "bashCapable": "bash-only",
    "keepSafetyAndDiagnostics": true
  },
  "stuck": {
    "remindAfterIdenticalCalls": 5,
    "terminateAfterIdenticalFailures": 8
  }
}
```

## Implementation order

1. Add the two thresholds and the recent-window floor to the context assembler.
2. Add rule-based elision for stale tool observations. Keep a short stub with tool name, exit status and an id. Do **not** add a recall tool in the first change.
3. Add summarization only as the second stage, for the oldest middle events.
4. Inject the current plan on every turn instead of appending every plan revision to history.
5. Route the action space by a measured bash score, not by model name.
6. Add identical-call detection and post-edit diagnostics.
7. Evaluate with matched settings. Report success, cost and overflow failures separately. A harness change that only lowers cost is not an accuracy win.

## Run the audit

```bash
node scripts/harness-audit.mjs trajectory.json
node --test scripts/harness-audit.test.mjs
```

The audit is intentionally small. It does not execute a model or claim a benchmark result. It flags the conditions the paper found actionable and returns the recommended policy.
