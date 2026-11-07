# Interactive care replies

Ask GlucoFlow can show an **Explore this reply** card for a reply that cites current workspace events or proposes a monitoring or handover action with a valid encounter link and matching workspace records. The card offers an encounter picker when a reply covers multiple encounters. It opens cited events in the same source inspector used elsewhere in the workspace. Monitoring status shows current matching tasks and can be filtered by their stored state.

The client composes a small OpenUI Lang program from the authorized workspace response. The timeline includes only the reply's cited events and orders them by occurrence time. The monitoring view includes only records matching an encounter and order referenced by a citation or a validated proposal. Encounter-level references match encounter-level monitoring records. The message text and proposed action cards remain available independently. Approvals still go through the existing human review and server authorization paths.

The allowlisted library has three Glucoflow components for the reply, encounter panel and cited event. It has no external links, tool provider, or custom action executor. Workspace strings are encoded as literals, including OpenUI message marker sequences. The source inspector callback resolves the event in the card's validated citation map. This is a deterministic app-composed view of synthetic records for both Hermes and offline replies. Glucoflow disables observability publication, blocks the installation telemetry hook, and suppresses OpenUI's floating development inspector.

## Provenance

The interactive answer pattern comes from an independent Thesys reference application at commit `9df2e64bc44282f6305a47eb6dbbbd8f28139138`, copyright 2026 Thesys Inc. The Glucoflow components and layout were written for the existing React client. [Open Intelligent UI](https://github.com/thesysdev/open-intelligent-ui/tree/9df2e64bc44282f6305a47eb6dbbbd8f28139138), [reference application MIT license](https://github.com/thesysdev/open-intelligent-ui/blob/9df2e64bc44282f6305a47eb6dbbbd8f28139138/LICENSE).

Glucoflow uses the published renderer and language packages `@openuidev/react-lang@1.0.0` and `@openuidev/lang-core@1.0.0`. The client distributes their shared MIT notice, copyright 2011–2024 Thesys Inc. [OpenUI](https://github.com/thesysdev/openui), [distributed license](../apps/client/public/licenses/openui.txt).

## Verification

Run these checks from `app/`.

```sh
TSX_TSCONFIG_PATH=tsconfig.web.json node --import tsx --test apps/client/src/features/care/intelligent-program.test.ts
pnpm exec tsc -p tsconfig.web.json --noEmit
```

Five focused checks passed on Node 22.23.1, covering workspace-scope filtering, chronological deduplication, exclusion of model prose, and literal rendering of injected quotes and transport markers. Local Chromium checks passed at 1440 × 900 and 390 × 844. Both changed the selected encounter, opened the matching LIS source inspector, filtered current monitoring status, and reloaded the saved reply without page errors or horizontal overflow.

This covers the care reply's source access, UI and synthetic disclosure under R02, R03, R08 and R17. [MVP acceptance checklist](../../docs/mvp/10-acceptance-checklist.md).
