# Mise implementation state

Status: **CURRENT**

Last verified: 2026-08-15

## Authoritative baseline

`origin/main` is the sole authoritative implementation baseline for Mise. This pilot work was freshly integrated from:

```text
05b3fe9eca8fd6f8eee9579b10fde8a0586ef8d9
```

Historical branches remain evidence only. Do not resume or merge them wholesale.

## Current verdict

Mise remains a **controlled-pilot/private-beta codebase**. The current pilot integration adds:

- tenant-scoped first-restaurant readiness reporting;
- truthful Square processed-row counts and replay test sources;
- explicit supplier From/To/Subject review;
- an atomic backend binding between the reviewed envelope and Gmail execution;
- fail-closed Home, Today, Orders, and POS readiness presentation.

Count-time-anchored depletion is now implemented (MISE-001): projected on-hand, count freshness, and recommendation suppression derive from verified `inventory_events` count evidence instead of `inventory_items.last_updated`.

This is **not yet a pilot-ready claim**. Provider-identity recipe mapping, readiness enforcement at recommendation approval/drafting, durable signal-refresh failure evidence, the complete failure matrix, and controlled hosted provider proof remain open. See `docs/pilot/FIRST_RESTAURANT_GAP_AUDIT.md` and `docs/pilot/FIRST_OPERATING_LOOP_EVIDENCE.md`.

## Verification

The imported candidate has passed:

- `npm run typecheck`
- `npm test` — 508 pass / 0 fail
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker and the local Supabase CLI are unavailable. Database execution and live Square/Gmail evidence must be recorded through hosted staging or reported as external.

## Next milestone gate

Finish and merge the first controlled restaurant operating loop. Continuous operations may begin only after all code gaps are closed and the pilot is classified as either:

- `READY FOR FIRST CONTROLLED RESTAURANT PILOT`; or
- `READY AFTER EXTERNAL CONFIGURATION` when every remaining blocker is genuinely external.

## Documentation authority

Current:

- `docs/implementation/STATE.md`
- `AGENTS.md`
- `docs/product/mise-operational-backend-master.md`
- `docs/pilot/`

Historical or superseded:

- `docs/implementation/DECISIONS.md`
- `docs/implementation/PR_INTEGRATION_PLAN.md`
- `docs/implementation/CLAUDE_HANDOFF.md`
- `docs/implementation/CLAUDE_CONSOLE_AGENT_PROMPT.md`
- `docs/implementation/AGENT_KIT_README.md`
