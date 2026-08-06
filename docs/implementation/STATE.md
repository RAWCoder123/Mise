# Mise implementation state

Last updated: 2026-08-05 (Cursor bootstrap for Claude principal-implementer kit)  
Working branch: `cursor/initial-mise-import`  
HEAD: `bdb18814960b5034b90bfa6e5202bf7e60ced4f9` — *Refine concept fidelity across core screens*  
Remote: `origin/cursor/initial-mise-import` — **local ahead by 125 commits** (0 behind)  
`main`: `be5a3c079555c56f19c5060993c8bfaa01c5eb35`

## Verdict

**Do not treat public `main` + PR stack #1–#4 as the complete product.**  
The real working product is this branch tip **plus a large dirty worktree** (~174 porcelain paths). That dirty tree holds Milestone 4 operating-plan/tasks, Square backend, waste, phase briefs, Ask Mise, and further UI densification that are **not on any `split/*` PR**.

Integrating only PRs #1–#4 onto clean `main` would **drop** that work unless it is first committed or otherwise preserved.

## Authoritative inputs (staged)

| Role | Path |
| --- | --- |
| Canonical master spec | `docs/product/mise-operational-backend-master.md` |
| Prior in-repo copy (keep in sync; prefer product path) | `docs/MISE_OPERATIONAL_BACKEND_MASTER_PROMPT.md` |
| Claude principal prompt | `docs/implementation/CLAUDE_CONSOLE_AGENT_PROMPT.md` |
| Kit README | `docs/implementation/AGENT_KIT_README.md` |
| UI references | `docs/design/references/ui-clean-desktop.png`, `ui-clean-mobile.png`, `ui-warm-mobile.png` |
| Agent guide | `AGENTS.md` |
| Last tandem batch | `docs/launch/CURRENT_BATCH.yaml` (`daily-operating-plan-41`, **status: complete**) |

## Git truth (verified 2026-08-05)

### PR ancestry (local branches)

Hypothesis from the Claude prompt **verified**:

| PR | Branch | Base | Commits on base | Ancestry |
| --- | --- | --- | --- | --- |
| #1 | `split/domain-decouple` @ `605734c` | `main` | 1 | PASS |
| #2 | `split/repo-split-realtime` @ `060037c` | #1 | 2 | PASS |
| #3 | `split/design-system` @ `05c5c02` | #2 | 6 | PASS |
| #4 | `split/mockup-redesign` @ `395bd19` | #3 | 1 | PASS |
| #5 | `split/order-automation` @ `2d56897` | #3 (not #4) | 1 | PASS |
| #6 | `split/dependency-alignment` @ `ca39a25` | `main` | 1 | PASS |

### Critical divergence

- `main` **is** an ancestor of `HEAD` (`163` commits `main..HEAD`).
- `split/domain-decouple` **is** an ancestor of `HEAD`.
- `split/repo-split-realtime`, `design-system`, and `mockup-redesign` are **not** ancestors of `HEAD`.
- Merge-base(`HEAD`, `split/mockup-redesign`) = `605734c` (PR #1 tip only).
- Local product evolved on `cursor/initial-mise-import` after PR #1, including later concept UI commits (e.g. `7cbc68d`, `fdd7ef5`, `bdb1881`), **in parallel** with the stacked PR #2–#4 path.

### GitHub PR / CI

Open PRs confirmed:

- https://github.com/RAWCoder123/Mise/pull/1 … `/pull/6`
- All six: open, not draft, `MERGEABLE` per API
- **statusCheckRollup: empty / NONE** for all six — do not treat PR description checkboxes as green CI

Many other open **draft** inspection PRs (`cursor/mise-product-inspection-*`, etc.) exist and are unrelated to the six-way stack.

## Dirty worktree risk (do not lose)

Snapshot: **~174** porcelain paths (**~88** modified, **~86** untracked).

Examples of **untracked** capability that exists only in the worktree (not in HEAD):

- Daily operating plan: `services/domain/operatingPlan.ts`, `services/application/operatingPlan.ts`, `components/operations/**`, `tests/operatingPlan.test.ts`
- Shared restaurant tasks: `services/domain/restaurantTasks.ts`, migration `20260802222329_shared_restaurant_tasks.sql`, related tests
- Operational foundation / waste migrations and domain
- Square OAuth/webhook edge functions + `docs/square-backend.md`
- Ask Mise, daily report, floor notes, phase briefs, autonomy, restaurant memory
- Staged agent kit under `docs/product/`, `docs/design/`, `docs/implementation/`

**First writer action (Claude, after user allows commits):** create one or more checkpoint commits on this branch (or a named rescue branch) that capture the dirty tree before any merge/rebase of the public PR stack.

## Baseline gates (this machine, 2026-08-05)

| Gate | Result |
| --- | --- |
| `npm run typecheck` | **PASS** |
| `npm test` | **PASS** — 439 pass / 0 fail |
| Docker / pgTAP full migration chain | **not run** this session |
| Hosted staging credentialed proof | **not run** |
| Live POS / model / Gmail | remain fail-closed / external |

## Honest unfinished (external / process)

- Latest migration chain not re-proven through Docker pgTAP + fresh hosted staging in this session
- Live POS providers, live model calls, live Gmail still outside private-beta boundaries
- App Store / TestFlight production submit not claimed here
- Public `main` still thin; product lives on this branch + dirty tree
- PR stack CI checks absent — need local/CI run before merge decisions

## Recommended next slice (Claude)

1. **Preserve dirty tree** (checkpoint commit / rescue branch) — blocking before stack merges.
2. Decide integration strategy: **prefer promote `cursor/initial-mise-import` (+ checkpoint) as integration trunk**; cherry-pick only missing unique commits from PR #2–#6 after diff inventory (Realtime revocation, dependency pin, order-automation evaluator).
3. Do **not** reset this worktree onto `split/mockup-redesign`.
4. After preservation: continue masterdoc vertical slices starting from Section 11 phase briefs / remaining Observe→Report gaps, with tests + no fabricated staffing/weather/reservations.

## Consultations

Log under `docs/implementation/consultations/`. Cursor bootstrap here is staging + repository-truth only; no product code edits in this pass beyond docs/kit assets.
