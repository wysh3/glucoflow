# Video reference and implemented redesign — 7 November 2026

## Inspection method
Extracted all 2,724 decoded frames from the supplied 1276×718 video. Reviewed contact sheets covering the sequence at two-second intervals and inspected selected full-resolution frames. This is not a claim of manually inspecting every decoded frame. The [gallery and frame-step viewer](evidence/video-reference-2026-11-07/index.html) includes the full index and local access to every extracted frame.

## Sequence and selection
| Time | View | Decision |
| --- | --- | --- |
| 0–6s | Full home window | Use frame 1 at 0s: least occluded home reference. Narrow sidebar, centered four-card canvas, suggestions, composer. |
| 8–20s | Zoom into prompt and answer | Use for interaction sequence only; not overall geometry. |
| 22s | Full list window | Compact list, one search field and one creation action. |
| 24–36s | Zoom into list and budget detail | Avoid as full-layout reference. |
| 38s | Full detail window | Summary followed by data, persistent navigation. Narrator partly obscures lower-right. |
| 40–52s | Prompt, progress, inline answer table | Evidence for home-to-chat transition; zoomed content. |
| 54s | Full conversation window | Same sidebar; focused reading column; composer remains available. Captions cover the lower edge. |
| 56s | Home window | Confirms reversible home/chat flow. |
| 58–80s | Suggestions and long answer, zoomed | Contextual suggestions and expandable working details; financial recommendations do not transfer to clinical scope. |
| 82s | Zoomed investments | Not selected. |
| 84–90s | Full home window | Confirms persistent shell and return-home layout. |

## Implemented
- Reduced default sidebar width from 320px to 240px, preserving saved user sizing, resizing and 64px collapsed rail.
- Centered 704px home canvas, neutral surfaces, subtle borders/shadows, four operational cards and aligned composer.
- Responsive compact spacing on shorter desktop screens; single-column mobile with scrollable composer access.
- Two-column plain suggestion layout; compact three-column suggestions on short desktop screens.
- Reversible Shift overview / Back to conversation control. Existing messages and unsent draft survive this view change. Sending from overview switches into the conversation.
- Existing source evidence, role authorization, synthetic labels, approval and speech controls remain in place.

The layout closely follows the video, with domain-specific content. It is not a pixel-identical copy: GlucoFlow retains its access controls, honest runtime status and clinical-scope requirements. No decorative financial chart, invented outcome, diagnosis or treatment recommendation was added.

## Fresh verification
TypeScript passed. Local browser: home → suggestion → deterministic reply → overview → conversation, with retained draft and messages. Collapsed icon rail verified. Desktop 1440×900 screenshot inspected. Mobile 390×844: document width 390px, no horizontal overflow, composer editable and reachable. Live Hermes was unavailable locally; this test explicitly used the deterministic helper and makes no live-agent quality claim. Backend, Android and speech-provider execution were not retested for this layout revision.

## Publication
Vercel deployment `dpl_GvxVHWVNZrpM8TTfrH4XLwjynP83` reached READY and was aliased to https://glucoflow.vercel.app/. Opened the hosted clinic workspace, created a fictional simulation and verified the rendered home and controls. Screenshot: `evidence/video-reference-2026-11-07/published-home.jpg`. Hosted readiness reported Hermes connected; no live message was sent in this verification.
