# Mise implementation state

Last updated: 2026-08-05 (Claude session: dirty-tree preservation + recalculation cycles)  
Working branch: `rescue/ops-backend-20260805` (pushed to origin)  
Branched from: `cursor/initial-mise-import` @ `bdb1881` — *Refine concept fidelity across core screens*  
`main`: `be5a3c079555c56f19c5060993c8bfaa01c5eb35`

## Verdict

**Do not treat public `main` + PR stack #1–#4 as the complete product.**  
The real working product is `rescue/ops-backend-20260805`. It holds Milestone 4 operating-plan/tasks, Square backend, waste, phase briefs, Ask Mise, and further UI densification that are **not on any `split/*` PR**.

Integrating only PRs #1–#4 onto clean `main` would **drop** that work.

## Preservation: DONE (2026-08-05)

The previously at-risk dirty worktree (~175 porcelain paths) is **committed and pushed**. The worktree is clean.

| Commit | Contents |
| --- | --- |
| `0103656` | Operational backend data layer — 4 migrations, 3 pgTAP suites, Square edge functions, OAuth scaffolding |
| `e0c6b8b` | Domain + application services with unit coverage |
| `0f4983a` | Operator-facing UI for the operational backend |
| `82df532` | Masterdoc, agent kit, implementation state |

No secrets were committed; only `.example` files with placeholder keys.

The PR-stack integration (Phases B–D of `PR_INTEGRATION_PLAN.md`) is **still outstanding** — preservation only removed the risk of losing work, it did not integrate the six split PRs.

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

## Work added this session

**Batch `recalculation-cycles-44`** — roadmap increment 3 (scheduled recalculation cycles with explicit monitoring ownership), masterdoc Section 26 "Background Jobs".

- `services/domain/recalculationSchedule.ts` — decides which of `daily_open` / `mid_shift` / `close` is due. Idempotency keys, exponential backoff, dead-lettering, restaurant-local 04:00 service-day rollover, per-cycle monitoring owner.
- `services/application/recalculationCycles.ts` — executes due cycles through injected ports. Per-cycle timeout, failure isolation, fail-closed on an unreadable ledger.
- `tests/recalculationSchedule.test.ts` (12) and `tests/recalculationCycles.test.ts` (10).

**Deliberately not done:** no run-ledger migration, no persistence wiring, no cron trigger, no UI surfacing of dead-lettered cycles. The executor takes ports so persistence can land next.

## Baseline gates (this machine, 2026-08-05, post-change)

| Gate | Result |
| --- | --- |
| `npm run typecheck` | **PASS** |
| `npm test` | **PASS** — 461 pass / 0 fail (was 439; +22 new) |
| `npm run security:backend` | **PASS** |
| `npm run security:static` | **PASS** |
| `npm run design:static` | **PASS** |
| `npm run qa:routes` | **PASS** |
| Docker / pgTAP full migration chain | **not run** — Docker unavailable on this machine |
| Hosted staging credentialed proof | **not run** |
| Live POS / model / Gmail | remain fail-closed / external |

## Honest unfinished (external / process)

- Latest migration chain not re-proven through Docker pgTAP + fresh hosted staging in this session
- Live POS providers, live model calls, live Gmail still outside private-beta boundaries
- App Store / TestFlight production submit not claimed here
- Public `main` still thin; product lives on this branch + dirty tree
- PR stack CI checks absent — need local/CI run before merge decisions

## Recommended next slice

1. ~~Preserve dirty tree~~ — **done**, see Preservation above.
2. Persist the recalculation run ledger: additive migration + pgTAP, wire `RecalculationPorts` to `supabaseRepository`, then trigger `runDueRecalculationCycles` on a schedule (Edge Function or cron). This is the direct continuation of this session's work.
3. Surface dead-lettered cycles in the app — masterdoc Section 26 forbids hiding background-job failures, and the data is already on `RecalculationCycleReport.needsOperatorAttention`.
4. Integration strategy still open: **prefer promoting this trunk**; cherry-pick only missing unique commits from PR #2–#6 after diff inventory (Realtime revocation, dependency pin, order-automation evaluator).
5. Do **not** reset this worktree onto `split/mockup-redesign`.

## Consultations

Log under `docs/implementation/consultations/`. Cursor bootstrap here is staging + repository-truth only; no product code edits in this pass beyond docs/kit assets.
