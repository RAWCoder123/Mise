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
- `tests/recalculationSchedule.test.ts` (12) and `tests/recalculationCycles.test.ts` (11).

**Batch `recalculation-ledger-45`** — makes the above actually run.

- `supabase/migrations/20260805120000_recalculation_run_ledger.sql` — append-only `public.recalculation_runs`, `public.record_recalculation_run` RPC (auth.uid() + active membership, advisory lock, `is distinct from` replay), and `private.capture_recalculation_run_activity`. Reuses `automation_failed` / `forecast_updated` rather than adding activity types. No feature flag column; `operational_mode` already pauses it.
- Repository: `listRecalculationRuns` / `recordRecalculationRun` on the contract, Supabase (RPC-only writes), and demo parity, plus `recalculation_runs` in `RESTAURANT_EXPORT_DATASETS` and the export edge function. Demo state → `schema_version: 9`.
- `services/application/recalculationPorts.ts` — takes a narrow `RecalculationLedger` (not the repository singleton, which keeps it off the RN import chain and testable). Memoized `runCycle`; PG `55000` pause swallowed so a paused Mise defers rather than dead-lettering.
- `services/application/scheduledRecalculations.ts` + `services/presentation/recalculationPresentation.ts` — never-throwing entry point and a pure attention summary.
- Home awaits dispatch before its data fetch; dead letters render a warning `StatusNotice` routing to `/more/activity`. Activity rows show attention as a `Badge`.

**Batch `warm-canvas-46`** — aesthetic pass against `docs/design/references/`.

- `colors.canvas` (#FAF8F5) for the page, keeping `background`/`surface` white for cards and inputs. `design:static` pins token *values*, not consumers, so the lock holds and the AGENTS.md "warm neutral background" tension is resolved.
- `radii.lg` 14 → 16; app bar keeps its locked `height: 56` and gains a hairline bottom border.
- Contrast audit: 14 input fills `background` → `surface`; `AppErrorBoundary` shell and `EmptyState` dashed insets → `canvas`; five warm blocks that sat directly on the page → `surface`.
- Fraunces (loaded and gate-required but previously unused) now renders the Home greeting, `EmptyState` titles, and `OperationalHero` titles. **No CJK glyphs — zh-Hans falls back to system sans in those three places.**
- Home collapsed onto primitives: `RestaurantStatusCard` → `StatusNotice` (which gained an optional `meta` line), briefing card gained `BriefClipboardIllustration`. Nine dead style rules and three dead imports removed.

**Deliberately not done:** no cron / machine-actor path (see below); no `paddingHorizontal` bump on `CompactMetricStrip` and no `today.tsx` floor-note collapse, both skipped because the 390px overflow gate could not be run.

## Baseline gates (this machine, 2026-08-06, post-change)

| Gate | Result |
| --- | --- |
| `npm run typecheck` | **PASS** |
| `npm test` | **PASS** — 476 pass / 0 fail (was 439 at session start) |
| `npm run security:backend` | **PASS** |
| `npm run security:static` | **PASS** |
| `npm run design:static` | **PASS** |
| `npm run qa:routes` | **PASS** — last run after the backend phases, **before** the aesthetic phases |
| `npm run qa:interactions` | **PASS** (EN + ES + 简体中文) — same caveat: run before the aesthetic phases |
| `npm run qa:mobile-layout` | **NOT RUN** for the aesthetic phases |
| Docker / pgTAP full migration chain | **not run** — Docker unavailable on this machine |
| Hosted staging credentialed proof | **not run** |
| Live POS / model / Gmail | remain fail-closed / external |

### Unverified visual risk

The warm canvas, `radii.lg` bump, Fraunces placements, and Home card collapse
landed **without** a browser layout or interaction run. Specifically unproven:
390px horizontal overflow in Spanish and Chinese, the Fraunces CJK fallback,
and the literal-copy assertions `qa:interactions` makes about Home. Run
`npm run qa:mobile-layout && npm run qa:interactions` before trusting these.

## Honest unfinished (external / process)

- Latest migration chain not re-proven through Docker pgTAP + fresh hosted staging in this session
- Live POS providers, live model calls, live Gmail still outside private-beta boundaries
- App Store / TestFlight production submit not claimed here
- Public `main` still thin; product lives on this branch + dirty tree
- PR stack CI checks absent — need local/CI run before merge decisions

## Recommended next slice

1. ~~Preserve dirty tree~~ — **done**.
2. ~~Persist the recalculation run ledger and wire the ports~~ — **done**.
3. ~~Surface dead-lettered cycles~~ — **done**.
4. **Run the visual gates** (`qa:mobile-layout`, `qa:interactions`) against the aesthetic phases and fix any 390px overflow. This is the highest-value next action — the aesthetic work is unverified.
5. **Prove the migration chain.** `recalculation_run_ledger.test.sql` and the `tenant_isolation` allowlist edit have never executed. Needs Docker + `npm run supabase:test`.
6. Real scheduling. Today cycles only run when an operator opens Home, so a restaurant nobody opens gets no recalculation. A cron path needs a machine-actor auth story: `scripts/security-backend.mjs:216-222` forbids `service_role` EXECUTE on new `public.*` SECURITY DEFINER functions, so this means extending that gate's allowlist deliberately, not incidentally.
7. Differentiate the three cycles. All three currently drive the same `regenerateOperationalSignals`; `close` should reconcile the day rather than repeat the open.
8. Integration strategy still open: **prefer promoting this trunk**; cherry-pick only missing unique commits from PR #2–#6 after diff inventory (Realtime revocation, dependency pin, order-automation evaluator).
9. Do **not** reset this worktree onto `split/mockup-redesign`.

## Consultations

Log under `docs/implementation/consultations/`. Cursor bootstrap here is staging + repository-truth only; no product code edits in this pass beyond docs/kit assets.
