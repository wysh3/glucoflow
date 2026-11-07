# Gluco landing refinement — 7 November 2026

Read all three requested reference pages:
- https://x.ai/news/introducing-grok-bot — a recognizable assistant identity and plain-language delegation.
- https://openai.com/index/introducing-dots/ — direct introduction, concrete work, and user control.
- https://hermes-agent.nousresearch.com/ — a single product promise and clear entry action.

The existing sign-in route now introduces Gluco with its existing care-cap orb, a centered typographic headline, one primary Explore the clinic CTA, and secondary patient access. It uses a restrained off-white surface and charcoal primary action. A compact illustrative source → owner → approval workflow replaces the large imitation chat window. This is an example, not a live integration or outcome claim.

Preserved: existing authentication, redirects, disabled/unavailable/loading/error states, demo account handling, patient access, alternate team roles, language picker, receipt/privacy/walkthrough links, and non-demo email/password form. No second entry route was added, and no fake interactive composer or unconnected buttons were introduced.

Verification: full TypeScript check passed; client production build passed. The coordinating session owns final browser rendering and hosted deployment verification. No claim of screenshots or responsive click-through is made in this subtask report.

## Original blueprint artwork

The user's original PDF cover image is now the landing hero artwork at `/brand/gluco-care-companions.png`. Its four colourful care companions are shown through a responsive CSS crop so the embedded title and feature captions do not duplicate the page heading. The source image itself is preserved unmodified. Desktop places copy and primary entry beside the artwork; mobile places entry actions before it. A neutral caption keeps the human decision boundary clear. The existing functional orb remains in the header.

After this change: full TypeScript check and client build passed. Coordinating session verifies the crop and deployed viewport.
