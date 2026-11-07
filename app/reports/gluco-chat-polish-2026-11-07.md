# Gluco chat and care desk refinement — 7 November 2026

## Implemented

- The structured handover format now renders a short introduction and the existing interactive encounter cards, including the handover owner and recorded uncertainty. It no longer prints the entire snapshot followed by an identical proposal body. Original content and timestamps remain available through an explicit button; evidence still resolves only inside the authorized workspace. Arbitrary prose and untranslated languages are not silently rewritten.
- Enter sends; Shift+Enter inserts a newline. IME candidate confirmation and Alt+Enter do not send. The input exposes the shortcut description to assistive technology.
- The primary composer no longer displays a provider/version/model selector. A compact Chat options control exposes the response mode and shortcuts. The deterministic helper remains explicitly labelled “no AI”; it is never relabelled as a live assistant.
- User-facing runtime labels in the care chat, record guide and extraction review use Gluco. Shared operational templates are labelled Care routines throughout their capture/review/application UI. Existing API/schema identifiers remain compatible.
- The home screen is “Your care desk.” Three direct task-detail entry points replace the passive status-count panel. They show task, patient and status; approvals are listed first, then oldest tasks. This is workflow ordering, not clinical triage. Existing source-event and ownership access remain.
- The pending reply consumes actual public backend progress labels from `state.chatProgress`, with Connecting until an event is received. No generated reasoning or hidden chain of thought is displayed.
- Send and Stop use distinct React keys and explicit click callbacks. Root is conducting hosted cancellation verification; this report does not assert that the click issue was resolved by that change alone.

## Verification

- `TSX_TSCONFIG_PATH=tsconfig.web.json node --import tsx --test apps/client/src/features/care/intelligent-program.test.ts`: 7/7 passed. Includes adversarial source links/literal rendering, preserved source scope, ordinary summary, handover owner and uncertainty. The new handover regression failed before implementation.
- `pnpm --pm-on-fail=ignore exec vitest run tests/integration/composer-keys.test.ts`: 1/1 passed (plain Enter, Shift, Alt, composing state, legacy IME code and unrelated keys).
- `pnpm --pm-on-fail=ignore typecheck`: passed.
- `pnpm --pm-on-fail=ignore --filter @glucoflow/client build`: passed. Existing Capacitor ineffective-dynamic-import warning remains; not a build failure.

Hosted click-through and deployment are owned by the coordinating session and must be recorded separately. This UI pass does not establish clinical readiness or instant model completion.
