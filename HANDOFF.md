# Glucoflow handoff — hosted deployment, 3 October 2026

Glucoflow is deployed at https://glucoflow.vercel.app. Vercel serves the frontend;
Azure Container Apps runs the API and the live GPT-6 Luna worker; Supabase provides
Auth, PostgreSQL and private Storage. Read [hosted deployment evidence](app/reports/hosted-deployment-2026-10-03.md)
and [hosted operations](app/docs/HOSTED.md) first. Deployment was authorized with up
to US$10 of Azure credits, without a subscription upgrade. Synthetic demo credentials
are private in `app/.local/hosted-demo-credentials.json`.

## Local verification before deployment

126 tests, 56 fixture browser checks, 12 database checks, 6 mutation checks, production bundles, three real Luna production-worker documents and 25/25 real Luna API smoke checks pass. Corrected observation-only evaluation on 12 examined synthetic documents: complete fields 0.9091, precision/recall 1.0000, identity-state accuracy 1.0000, date exact 0.9091. This is not independent clinical validation.

## Earlier local evidence

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
- Hosted session refresh/sign-out uses one managed Supabase client and existing secure native storage. Hosted browser sign-in/sign-out and private PDF rendering have now been exercised against the real services. Native physical-device verification remains pending.

## Earlier measurement (superseded)

The unfamiliar-layout synthetic regression corpus still gives complete-field accuracy **0.24**, precision **0.875**, recall **0.56**. No live model was called. These results are not a claim of clinical accuracy or time saved. The already examined corpus is regression data, not an independent holdout for the next engine iteration.

## Next steps

1. Review the corrected Luna evaluation and prepare an independent holdout. Keep the key in ignored `app/.env`. Current local limits: $0.10/document, four calls/document, 120,000 tokens/document and $2/evaluation.
2. Review unsupported fields and identity/date errors; keep publication blocked until human review. Prepare a new independent holdout before claiming better generalization.
3. Hosted API smoke passed 25/25 with actual Supabase Auth/Storage and Azure worker processing; hosted database policy checks passed 12/12. Maintain the budget and retire demo resources when finished.
4. Verify the latest APK on emulator and an authorized physical device, including camera, source opening, exports and session recovery. This pass built the APK; it did not install it on a physical phone.
5. Prepare the demo tenant for recording, measure review time with real users, and reconcile the deck/submission against that evidence. Browser and smoke runs have left extra synthetic reports and notes in the local demo tenant; it was not reset or purged.

Phone OTP, live ABHA integration, productivity improvements and clinical outcomes are not implemented or measured claims. Product scope stays in `docs/mvp/`.
