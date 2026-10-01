# Home consumes pilot readiness (2026-08-24)

Rebased onto `origin/main` after MISE-003C (`2aa2ac1`). Supersedes the stale draft PR #136 tip.

## Completed

- Home loads `fetchPilotReadiness` in parallel with the operating brief and today summary.
- Fail-closed: readiness load failure or missing payload blocks one-tap recommendation approve.
- Material blockers surface on Home (recommend vs send vs unavailable) with EN/ES/zh-Hans copy.
- Recommendation cards show “Review setup” and route to `/settings/pos` when `canRecommend` is false.
- Supplier-send review cards still open the exact draft; they are not auto-executed from Home.

## Files

- `app/(tabs)/home.tsx`
- `services/presentation/homePilotReadinessPresentation.ts`
- `i18n/catalog.ts`
- `tests/homePilotReadinessPresentation.test.ts`
- `tests/pilotUiSafety.test.ts`
- `docs/automation-reports/2026-08-17-home-pilot-readiness.md`
- `docs/automation-reports/2026-08-24-home-pilot-readiness.md`

## Verification

- `npm run typecheck` — pass
- `node --test --import tsx tests/homePilotReadinessPresentation.test.ts tests/pilotUiSafety.test.ts` — 12 pass / 0 fail
- `npm test` — 605 pass / 1 fail / 7 cancelled (timeouts). Sole failure is the inherited hosted provider-mapping assertion in `tests/applicationProviderMappings.test.ts` (documented on main / MISE-003C STATE).

## Conflict avoidance

- Did not touch Codex MISE-004A paths (`orders.tsx`, repositories, migrations, purchase decision memory).
- Did not reopen scopes owned by open PRs #130–#135.

## Not claimed

- Server-side approval readiness enforcement.
- Orders-hub one-tap recommend readiness gate (deferred while MISE-004A owns `orders.tsx`).
- POS planning sync stale state (open PR #132).
- Live POS / Gmail / Apple / hosted pgTAP proofs.
