# CodexApp UI deployment

7 November 2026. The [public GlucoFlow demo](https://glucoflow.vercel.app) serves the attributed React adaptation of the published CodexApp shell and conversation presentation. The UI source is pinned to `@brutalstrikedevs/codexapp@0.1.91` under the MIT license. The [integration notes](../apps/client/src/vendor/codexapp/README.md) record which component structure and styles were reused. [Public MIT notice](https://glucoflow.vercel.app/third-party/codexapp-LICENSE.txt) · [Public provenance](https://glucoflow.vercel.app/third-party/codexapp-provenance.json)

## Production release

| Component | Release |
| --- | --- |
| Vercel production | `dpl_DnwA3XF95pR4kRmsMvfhKkcWmvok` |
| Previous Vercel production and rollback point | `dpl_2DUZyHYgJ6SxqipdutNNohyuu1vk` |
| Azure API | `glucoflow-service--voice20261107` |
| Azure worker | `glucoflow-worker--native20261107` |

The isolated Vite build passed its scan for known privileged values. Vercel reported Ready and assigned the production alias. The main JavaScript is `index-DMhVT1KR.js`, 1,409.57 kB before compression and 308.03 kB gzip. Vite reported the main chunk size warning.

This web release retained the deployed API, worker, schema and Sarvam limits. It produced no Android APK. To restore the preceding web build, run `vercel rollback dpl_2DUZyHYgJ6SxqipdutNNohyuu1vk --scope wyshs-projects --yes` from the linked app project.

## Hosted verification

- Landing, sign-in, privacy, care and patient overview requests returned the new SPA entry and security headers. The main script returned the expected JavaScript MIME type and immutable cache policy.
- The production stylesheet includes the upstream CodexApp scope. The public MIT notice and provenance JSON both returned HTTP 200, the expected MIME type and bytes identical to the source files.
- Chromium at 1440 × 900 verified the public shell, keyboard sidebar resize and collapse persistence through reload. At 390 × 844 it verified opening the navigation drawer, Escape dismissal and focus restoration. Both checks reported no horizontal overflow, page exceptions or API mutations.

Release verification completed at 15:11:52 IST. It made no model or speech provider calls.
