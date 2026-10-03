# Demonstration script

A reproducible walkthrough of both roles on web and Android, using the seeded synthetic
tenant. Every screen named here exists in the current build; the observed values are the
seeded ones.

## 0. Prepare (once)

```bash
cd app
pnpm install
pnpm db:start && pnpm db:migrate
pnpm fixtures:generate && pnpm fixtures:reference
pnpm seed:demo -- --clinic demo --confirm-demo
pnpm dev
```

Accounts and passwords are written to `app/.local/demo-credentials.json`. Open that file
to copy a password; do not paste passwords into tickets, screenshots or chat.

| Account | Role |
| --- | --- |
| `patient@glucoflow.demo` | Patient (P0482) |
| `clinic@glucoflow.demo` | Reviewer + clinician |
| `reviewer@glucoflow.demo` | Reviewer only |
| `clinician@glucoflow.demo` | Clinician only (no review queue) |
| `other-clinic@glucoflow.demo` | A second clinic, for the isolation checks |
| `other-patient@glucoflow.demo` | A second patient, for the isolation checks |

Reset to this state at any time:

```bash
pnpm reset:demo -- --clinic demo --confirm-demo
```

## 1. Clinic: the progression view (web)

1. Open <http://127.0.0.1:5173> and sign in as `clinic@glucoflow.demo`.
2. `Patients` lists P0482 Asha Rao (synthetic). Open the patient.
3. `Progression` opens with **HbA1c** selected: three approved points (8.2 % on
   12 January 2026, 7.9 % on 10 April 2026, 7.5 % on 09 July 2026) on a date-proportional
   axis. Run `pnpm reset:demo -- --clinic demo --confirm-demo && pnpm seed:demo -- --clinic
   demo --confirm-demo` first if earlier runs added uploads; the seed restores exactly
   these six approved documents and one patient note. The heading states the coverage scope, the panel states that lines connect
   recorded results, and no trend, target or interpretation is shown.
4. Switch to `Table` for the same values with their units and dates.
5. The lanes below separate `Prescriptions`, `Examinations`, `Patient-reported notes` and
   `Document availability`. A patient note is labelled **Patient reported** and carries a
   submission timestamp.
6. `Open source` on any value opens the source viewer: the quoted text from the original
   document with its page number, plus a 60 second signed link. `Refresh access` issues a
   new link.
7. `Export visit summary` creates a snapshot of the currently approved facts and note
   versions and downloads a PDF when the worker finishes.

## 2. Clinic: upload, review and approve (web)

The seed publishes six documents (January, April and July lab reports, the prescription and
the eye and foot examinations) and leaves nothing awaiting review, so the review sequence
starts with a real upload. The seed command prints the same instruction.

1. Sign in as `patient@glucoflow.demo`, open `Add report`, choose
   `fixtures/synthetic/sources/2026-09-14_lab_report.pdf` and upload it. The dialog reports
   *Upload complete* as soon as the worker has processed it.
2. In the patient context, open `Documents`: seven documents with their states.
3. Sign in as the reviewer, then open `Review queue` (`Awaiting review` filter): the
   September lab report.
4. The same sequence is automated end to end, with a freshly generated report, by
   `pnpm exec playwright test tests/e2e/upload-review.spec.ts`.
5. Open the review screen. Every proposed entry is listed with its quoted source text,
   the page number, and any issue. The panel header states
   **Fixture data: rule engine** because this environment runs the deterministic fixture
   provider, not a live model.
6. Review each entry explicitly (`Review`, `Correct` or `Exclude`). The approve button
   stays disabled until every entry has a decision; the reasons are listed.
7. Approve. One approval revision is created; the values appear in the progression view
   and in the patient's records.
8. Press the same approve action again with the same idempotency key: the original batch
   is returned rather than a second publication (`pnpm smoke` asserts this).

## 3. Clinic: reject and retry

1. In the queue, `Could not finish` lists quarantined or failed documents.
2. A wrong-patient upload is quarantined: the printed identifier does not match the
   assignment. The review screen explains that the identifier differs and that the
   assignment must be rejected; it cannot be overridden.
3. `Retry` is offered only for a retryable failure and is capped per hour. A quarantine
   cannot be retried.

## 4. Patient: upload and notes (web)

1. Sign in as `patient@glucoflow.demo` (use a separate browser profile or sign out first).
2. `My records` shows only the approved results for P0482, with the same chart and the
   original documents.
3. `Add report` opens the upload dialog: choose a PDF or a photo, confirm the patient and
   clinic, then upload. The dialog states the limits (15 MiB per file, 10 pages, 10 images
   per photo batch) and the honest limitation that an unsent photo or form cannot be
   recovered if the operating system stops the app.
4. `Visit notes` writes a patient note: a category, the note and an optional event date
   are required, the character limit is 1,000, and the submission timestamp is recorded
   separately from the event date. A note can be corrected; the correction is a new
   version and the earlier text stays in history.
5. `My uploaded reports` shows the review state of each upload: awaiting review, in
   review, approved, or needs attention.

## 5. Isolation checks (web)

1. Sign in as `other-clinic@glucoflow.demo`: the patient list is empty. Opening a P0482 URL
   from the first clinic returns *not found*, never a redacted record.
2. Sign in as `other-patient@glucoflow.demo`: only that patient's own record is visible.
3. As `clinician@glucoflow.demo`, opening `/clinic/queue` shows the reviewer-capability
   refusal.

## 6. Android

Install the signed release APK (see [`SETUP.md`](SETUP.md) section 7):

```bash
adb install -r apps/client/android/app/build/outputs/apk/release/app-release.apk
adb reverse tcp:8787 tcp:8787     # emulator: reach the host API on 127.0.0.1
```

1. Launch **Glucoflow**. The sign-in screen renders from the bundled assets with no dev
   server; the network configuration permits cleartext only for the local development
   hosts.
2. Sign in as `patient@glucoflow.demo`: `Records` shows the same approved progression with the
   bottom navigation (`Records`, `Add report`, `Visit notes`, `Account`).
3. `Add report` uses the camera or the file chooser; a denied camera permission falls back
   to the chooser.
4. `Account` shows the signed-in identity, the active authorized role and how the session
   is stored (secure storage on Android, `localStorage` on the web).

Verified on an API 35 emulator (see [`reports/device-check.md`](reports/device-check.md)).
A physical-device pass is still outstanding.

## 7. What the demonstration does not claim

* The fixture provider is a deterministic rule engine, not an AI model. Measured results
  are in [`reports/extraction-evaluation.json`](reports/extraction-evaluation.json).
* No diagnosis, risk score, treatment causation, screening deadline or imputation is
  produced anywhere. The interface shows recorded values only.
* Live ABHA/ABDM integration is not implemented. No such claim is made in the interface.
* Hosted authentication and storage are implemented but unexercised in this environment.
