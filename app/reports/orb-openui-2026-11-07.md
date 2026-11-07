# Original orb and interactive care replies — 7 November 2026

Deployed frontend `dpl_D8WbAguRdAN4R9bbNkUwy6sUXRK1` (READY).

- Restored upstream neutral body/eye paths; removed mouth and smiling eyes. Smaller teal medical cap. CSS blinking/swaying and bounded pointer tracking; no Skia/WASM runtime or claim of full native animation parity. Reduced-motion preference disables movement. Effects/listeners clean up on unmount.
- Existing OpenUI renderer now displays encounter rows directly. Recognized English workspace snapshots get concise introductory text, original per-order status without repeated timestamps/feed notices, one stale-feed notice, and a full-text toggle. Other languages/formats preserve original prose.
- Only authorized encounter/order/source links compile into the interface. Text is escaped OpenUI string data, never executable generated UI. Original reply and source timestamps remain intact. No model call added.
- Typecheck and all six compiler/rendering tests passed. Hosted saved Hermes conversation checked: compact rows → Evidence → correct HIS source dialog → close. Pointer gaze style changed from `translate(14px, 6.73958px)` to `translate(14px, 10px)` after pointer movement.
- Screenshot: `evidence/orb-openui-2026-11-07/hosted-reply.png`.

References checked: https://help.openai.com/en/articles/20001598-intelligent-ui-in-chatgpt and https://github.com/thesysdev/open-intelligent-ui. This is a bounded GlucoFlow implementation using existing OpenUI, not OpenAI's proprietary ChatGPT interface or unrestricted model-authored layouts.
