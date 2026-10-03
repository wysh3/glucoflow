# Sutra handoff — local completion pass, 3 October 2026

The local application is running at http://127.0.0.1:5173. The user requested local work only; deployment is deferred. OpenAI credentials and an evaluation spending limit are still awaited. Fixture extraction is labelled as such throughout the app.

## Current evidence

Read [local completion report](app/reports/local-fixes-2026-10-03.md), [completion plan](app/docs/COMPLETION_PLAN.md), and the captured commands under `app/reports/raw/local-fixes-*`. The takeover audit records the earlier defects; older reports are historical.

## Implemented in this pass

- Patient report state now agrees with publication, including approved clinic uploads. Staff review metadata remains private.
- Every photo-batch item is processed in order. Later-page identity mismatches hold publication. Original images have correct page mapping and review-page navigation.
- Progression loads independent observation, examination/prescription and note cursors. A changed publication revision blocks mixed history. All unit-separated panels remain visible; lists offer Load more.
- Corrections normalize the changed test/value/unit/date again. Intentional nulls remove obsolete graph values. Published corrections and amended uploads have visible, reasoned entry points.
- Patients can search, open their authorized sources and export summaries. Clinicians can acknowledge patient notes. Uploaded bytes can be completed after sign-in; missing files must be selected again.
- Provider calls reserve cumulative dollars and tokens before dispatch. Actual input/output usage is stored separately; unavailable usage retains its reservation. Evaluation also respects its whole-run dollar cap.
- Doctor progression has context alongside the chart on desktop. Mobile report cards keep filenames, states and actions together. Buttons meet the 44 px mobile target; account navigation returns to the authorized workspace.
- English OCR language data ships as a pinned dependency, rather than downloading during jobs. Android opens external sources through the Capacitor Browser plugin.
- Historical fact lookup now checks actor and patient-release access. Sign-in rate limits and correct 429/413 responses are enabled; signed URL query tokens are omitted from request logs.
- Hosted session refresh/sign-out uses one managed Supabase client and existing secure native storage. Native foreground/background refresh handling and hosted PDF/image CSP settings are prepared, but are not hosted-service verification.

## Measured limitation

The unfamiliar-layout synthetic regression corpus still gives complete-field accuracy **0.24**, precision **0.875**, recall **0.56**. No live model was called. These results are not a claim of clinical accuracy or time saved. The already examined corpus is regression data, not an independent holdout for the next engine iteration.

## Next steps

1. Add the OpenAI key to `app/.env` as `EXTRACTION_API_KEY`; keep it out of chat and Git. Agree the total evaluation spend, verify current model support/pricing, configure per-document and whole-evaluation caps, then run a labelled live evaluation on synthetic documents.
2. Review unsupported fields and identity/date errors; keep publication blocked until human review. Prepare a new independent holdout before claiming better generalization.
3. When the user authorizes deployment, verify actual Supabase Auth/Storage, hosted tenant isolation and containers. The session implementation is currently locally compiled only.
4. Verify the latest APK on emulator and an authorized physical device, including camera, source opening, exports and session recovery. This pass built the APK; it did not install it on a physical phone.
5. Prepare the demo tenant for recording, measure review time with real users, and reconcile the deck/submission against that evidence. Browser and smoke runs have left extra synthetic reports and notes in the local demo tenant; it was not reset or purged.

Phone OTP, live ABHA integration, productivity improvements and clinical outcomes are not implemented or measured claims. Product scope stays in `docs/mvp/`.
