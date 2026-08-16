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
- fail-closed Home, Today, Orders, and POS readiness presentation;
- exactly one manager-selected Square planning location;
- provider catalog-item and variation identity on live sales;
- guarded manager review into verified recipe versions;
- physical-count-anchored freshness and post-count depletion; and
- bounded provenance revalidation at recommendation approval, draft preparation, and send authorization.

This is **not yet a pilot-ready claim**. Durable signal-refresh failure evidence, end-to-end correlation, the complete failure matrix, exact hosted migration/function proof, and controlled provider proof remain open. See `docs/pilot/FIRST_RESTAURANT_GAP_AUDIT.md` and `docs/pilot/FIRST_OPERATING_LOOP_EVIDENCE.md`.

## Verification

The imported candidate has passed:

- `npm run typecheck`
- `npm test` — 519 pass / 0 fail
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`
- `npm run qa:mobile-layout`
- rendered Browser QA at 390 × 844, 375 × 812, and 320 × 812
- the complete migration chain in an ephemeral PostgreSQL 18 cluster

Supabase CLI `2.114.0` is available, but Docker is not. The local pgTAP suite is `NOT RUN`; Postgres.app does not include pgTAP. The configured hosted project is unavailable through the CLI link and pooler, so hosted database execution and live Square/Gmail evidence remain external.

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
