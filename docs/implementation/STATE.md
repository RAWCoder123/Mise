# Mise implementation state

Status: **CURRENT**

Last verified: 2026-08-14

## Start here

`origin/main` is the sole authoritative implementation baseline for Mise.

Before this documentation-only cleanup, the verified `origin/main` SHA was:

```text
e3d9f3472ecd90fa0a8392fb9a71c5cb5ff1d1ec
```

- PR #121, **Consolidate current Mise architecture, UI, and operational workflows**, merged on 2026-08-11 (`54dc88fa92e3df07584ad098676d81c1d8e7f179`).
- PR #127, **Reconstruct Mise UI from approved mobile references**, merged on 2026-08-14 (`e3d9f3472ecd90fa0a8392fb9a71c5cb5ff1d1ec`).
- All new development must branch from the latest fetched `origin/main`, not from a remembered SHA or an old development branch.

These paths are historical only and must not be resumed or merged wholesale:

- `rescue/ops-backend-20260805`
- `cursor/initial-mise-import`
- `split/*`
- `cursor/mise-product-inspection-*`

Historical branches, commits, evidence, and documents remain useful records. If an old branch appears to contain a useful idea, re-evaluate it against latest `origin/main` and implement it as a fresh, narrow PR.

## Current verdict

Mise is a **controlled-pilot/private-beta codebase**, not a public-production claim. The consolidated baseline includes:

- a real Supabase-backed operational backend with tenant roles and RLS boundaries;
- Today workflows, inventory and recipe operations, purchasing recommendations, supplier drafts, and activity records;
- server-side Square integration architecture and guarded Gmail/supplier delivery paths;
- scheduled recalculation foundations and operational evidence;
- the approved mobile reference reconstruction and mobile QA tooling.

Consolidation and the reference UI reconstruction are finished as baselines. The next milestone is not another repository integration, backend rewrite, or broad UI redesign.

## Recommended next milestone — first controlled restaurant operating loop

Prove one complete operating loop for one authorized restaurant:

1. Connect an authorized Square sandbox or pilot account and ingest truthful source data.
2. Confirm authoritative inventory items, recipe mappings, units, supplier recipients, and operating context.
3. Run the supported recommendation/recalculation path from observed sales and current inventory.
4. Produce one evidence-backed supplier draft with transparent quantities and reasons.
5. Require explicit authorized operator approval before any external communication.
6. Send through the authorized Gmail path only when provider controls and recipient checks are green.
7. Record the approval, send result, provider evidence, and resulting activity trail truthfully.
8. Capture a repeatable runbook and evidence bundle for the entire loop, including failure and recovery behavior.

The loop must preserve demo mode, tenant isolation, approval gates, idempotency, and fail-closed provider behavior. Do not simulate live success when credentials or provider proof are unavailable.

## External proof blockers

The following cannot be claimed from repository code alone:

- Docker-backed full migration and pgTAP execution;
- hosted Supabase security and tenant-isolation proof;
- authorized Square and Gmail credentials plus provider-side acceptance evidence;
- physical-device and TestFlight verification, including Apple account prerequisites.

Treat these as explicit evidence gates for the controlled pilot, not as reasons to rework the architecture speculatively.

## Documentation status

Current:

- `docs/implementation/STATE.md`
- `AGENTS.md`
- `docs/product/mise-operational-backend-master.md`

Historical or superseded:

- `docs/implementation/DECISIONS.md`
- `docs/implementation/PR_INTEGRATION_PLAN.md`
- `docs/implementation/CLAUDE_HANDOFF.md`
- `docs/implementation/CLAUDE_CONSOLE_AGENT_PROMPT.md`
- `docs/implementation/AGENT_KIT_README.md`
- `docs/code-status-readiness.md`
- `docs/agent-handoff-2026-07-21.md`

Do not use a historical document to select a branch, repeat consolidation, or define current readiness.
