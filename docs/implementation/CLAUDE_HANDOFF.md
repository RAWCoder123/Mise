# Claude handoff — HISTORICAL

Status: **SUPERSEDED**

> Historical document.
> This file describes Mise before repository consolidation.
> Do not use it as the current implementation source of truth.
> Current state: `docs/implementation/STATE.md`.

Paste `docs/implementation/CLAUDE_CONSOLE_AGENT_PROMPT.md` into Claude Console from the repo root, then read this file before changing code.

## Absolute local truth (do not discard)

1. Branch: **`cursor/initial-mise-import`** @ `bdb1881`  
2. **Ahead of origin by 125 commits**  
3. **Dirty worktree ~174 paths** — includes untracked Milestone 4 operating plan, shared restaurant tasks migration, Square backend, waste, Ask Mise, phase briefs, and this agent-kit staging  
4. Public `main` is thin (`be5a3c0`); PR stack #1–#4 is a **parallel** lineage after `605734c`, **not** contained in current HEAD  
5. Baseline on this machine: **typecheck PASS**, **npm test 439/439 PASS** (2026-08-05)

## First objective (kit) — status

| Step | Status |
| --- | --- |
| Stage masterdoc + UI refs + prompt | **Done** (see `docs/product/`, `docs/design/references/`, `docs/implementation/`) |
| Establish repository truth | **Done** → `STATE.md`, `PR_INTEGRATION_PLAN.md`, `DECISIONS.md` |
| Map PR ancestry / GitHub CI | **Done** — stack ancestry PASS; CI rollups **empty** |
| Preserve dirty tree via checkpoint commit | **Blocked on user commit authorization** |
| Integrate unique PR deltas | After preserve |
| Continue masterdoc vertical slices | After preserve |

## Do-not-lose paths (minimum)

- `services/domain/operatingPlan.ts` (+ application, presentation, Today UI, tests)  
- `services/domain/restaurantTasks.ts` + `supabase/migrations/20260802222329_shared_restaurant_tasks.sql`  
- `supabase/migrations/20260802204120_operational_backend_foundation.sql`  
- `supabase/migrations/20260803090000_waste_analysis_activity.sql`  
- Square: `supabase/functions/link-square/`, `square-oauth-callback/`, `square-webhooks/`, `_shared/square.ts`  
- `services/ai/askMise.ts`, `services/application/ask.ts`, daily report / floor notes / phase brief / autonomy / memory  
- Visual densification already in dirty `constants/theme.ts`, tab screens, `components/ui/**`  
- `docs/operational-backend/**`, `docs/launch/evidence/backend/**`  
- Newly staged `docs/product/**`, `docs/design/references/**`, `docs/implementation/**`

## Commands

```bash
npm run typecheck
npm test
# after UI/design lock changes:
npm run design:static   # if present
# when Docker/staging available:
# supabase tests / staging checks per package.json
```

## Consultation protocol

Cursor/Codex are **read-only reviewers by default**. Log consultations under `docs/implementation/consultations/`. Record accept/reject explicitly.

## Paste-ready Claude kickoff (after reading STATE.md)

> Read `docs/implementation/STATE.md`, `PR_INTEGRATION_PLAN.md`, and `docs/product/mise-operational-backend-master.md`. Confirm dirty-worktree risk. First write: checkpoint-commit the dirty tree on `cursor/initial-mise-import` (or `rescue/dirty-ops-*`) after I approve commits. Do not merge PR #1–#4 onto clean main. Then inventory unique commits from `split/repo-split-realtime`, `split/order-automation`, and `split/dependency-alignment` vs preserved HEAD. Continue masterdoc implementation only after preservation.
