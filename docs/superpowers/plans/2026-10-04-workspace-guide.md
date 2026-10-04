# Clinic workspace and app guide Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Execution is inline as explicitly requested; no delegation.

**Goal:** Deliver a compact landing, accessible app menus, consolidated doctor view and bounded GPT-6 Luna app guide on web and Android.

**Architecture:** Retain the existing React/Fastify/Supabase application. Add a clinic overview from authenticated approved timeline queries and a stateless assistant classifier whose outputs select server-owned help templates. No clinical-data integration with chat.

**Tech Stack:** React, Radix Select/Dialog, TypeScript, Fastify, GPT-6 Luna, Capacitor.

**Spec:** `docs/superpowers/specs/2026-10-04-workspace-guide-design.md`

## Global Constraints

- No diagnosis, clinical interpretation, treatment recommendations or automatic approval.
- Source evidence, verified roles, RLS, synthetic labels and explicit patient identity remain intact.
- Assistant: message ≤600 characters, output ≤120 tokens, timeout ≤15 seconds, per-actor 12/minute, concurrent calls ≤2, configurable hourly ceiling.
- Doctor overview shows approved data separately from illustrative scenario.
- Keep private keys server-side; preserve untracked user decks.

## Review Focus

- Short screens and enlarged text must retain reachable role buttons.
- Keyboard/touch dropdowns retain correct labels and selected form values.
- A role change clears chat and cannot leave links for the previous actor.
- Malicious provider prose, URLs or clinical content cannot become displayed chat output.
- Missing dates/records and truncated timeline data must not become current-medication or clinical conclusions.

### Task 1: Landing and dropdowns

Files: `app/apps/client/src/features/sign-in/page.tsx`, `app/apps/client/src/index.css`, `app/packages/ui/src/components/input.tsx`, `app/tests/e2e/workspace.spec.ts`.
Interface: preserve Select HTML-style value/onChange/option callers through a Radix adapter; landing keeps existing role sign-in.
- [x] Write browser tests for inset/no overflow at desktop/mobile sizes and in-app selection with keyboard.
- [x] Run tests; verify failure on current spacing or missing in-app listbox.
- [x] Implement centered compact landing, safe-area spacing and Radix Select adapter.
- [x] Run browser checks and typecheck.

### Task 2: Doctor overview and sidebar

Files: new `app/apps/client/src/features/clinic/overview/page.tsx`; modify routes, patient header, shell and role landing links; same browser spec.
Interface: consume `useTimeline`, `useDocuments`, `usePatient`, `useSourcePane`; produce source-backed overview route and sidebar destinations.
- [x] Write browser checks for overview approved results/source and sidebar navigation.
- [x] Watch failures before implementation.
- [x] Implement latest-result cards, documented prescription/examination and note panels with links to full context.
- [x] Verify overview, role visibility and retained evidence/export journeys.

### Task 3: Bounded guide service

Files: new `app/apps/api/src/guide/catalog.ts`, `service.ts`, `service.test.ts`, `guide/routes.ts`; env contracts; new integration guide test.
Interface: POST `/api/v1/guide` accepts `{screen,message}`; returns `{message,actions:[{id,label}],mode:'live'|'local',model?:'gpt-6-luna'}`. Action IDs are server-owned, destinations client-owned.
- [x] Test clinical refusal, disallowed actions, malicious provider output, missing key, budgets, timeout, auth and invalid messages before implementation.
- [x] Implement role-derived catalogue, strict JSON classification, deterministic answer text, safe fallback, capped model call and no message logging.
- [x] Run focused service/integration tests and typecheck.

### Task 4: Orb guide client

Files: new orb and guide client components plus route integration and browser checks.
Interface: guide maps validated action IDs to current-role/current-patient local paths; stores chat in memory; resets on actor change.
- [x] Test guide dialog, navigation, refusal and close/keyboard behavior before implementation.
- [x] Implement a light mint orb with reduced-motion behavior, contextual suggestions and labelled local/live responses.
- [x] Run desktop/mobile browser checks; inspect manually with CUA.

### Task 5: Cleanup, verify and deliver

Files: root GitHub CI, README/docs, env example, verification report, screenshots and APK.
- [x] Fix repository-root CI paths and stale documentation without deleting historical evidence.
- [x] Run types, unit/integration, SQL, full browser suite and production builds; review final diff separately for permissions and clinical boundaries.
- [x] Build/sign Android and scan public outputs for privileged credentials.
- [x] Deploy API/frontend, verify live guide and doctor overview; record exact measured results and practical limits.
- [x] Commit, push main, verify GitHub and deployments; provide links and screenshots.

## Execution ledger

Design and plan approved through the user's explicit instruction to handle implementation details and complete deployment. Reuse the current checkout: only unrelated untracked user decks existed at start; leave them untouched. Author performs final review inline because AGENTS.md forbids delegation without user authorization.

Completed directly. Red checks established missing landing/listbox, overview and guide; service tests initially failed on the missing module. Integration authorization/throttle checks were added after the pure service and before delivery. 157 unit/integration tests, 78 full browser checks, 10 final focused checks, types, 12 SQL checks and production builds passed. Final browser checks cover the production minifier positioning fix and implicit option values. Hosted guide returned live GPT-6 Luna navigation help and fixed clinical refusal. See app/reports/workspace-guide-2026-10-04.md for delivery evidence and limits.
