# Today pilot readiness surfacing (2026-08-25)

## Gap

`docs/pilot/FIRST_RESTAURANT_GAP_AUDIT.md` marks Today as PARTIAL: connected POS can look complete even when sync is stale, and Gmail/recipient readiness is only indirect. `app/(tabs)/today.tsx` on `origin/main` never called `fetchPilotReadiness`.

## Closed

- Today loads `fetchPilotReadiness` alongside the operating plan.
- Fail-closed presentation gate (`todayPilotReadinessGate`) never claims the operating loop is ready when readiness is missing or failed.
- Incomplete areas surface reconnect / count / recipe mapping / supplier / Gmail repair actions with exact routes.
- Soft reload clears prior readiness before the next result so stale readiness cannot remain actionable.
- EN / ES / zh-Hans copy for Today readiness banners and action chips.

## Paths

- `services/presentation/todayPilotReadiness.ts`
- `app/(tabs)/today.tsx`
- `i18n/catalog.ts`
- `tests/todayPilotReadiness.test.ts`
- `tests/pilotUiSafety.test.ts`

## Verification

- `npm run typecheck` passed
- `npx tsx --test tests/todayPilotReadiness.test.ts tests/pilotUiSafety.test.ts` — 11/11 passed

## Avoided conflicts

- Did not edit `services/domain/todayTasks.ts` (#132)
- Did not edit Home/Orders recommend approve gate (#145)
- Did not edit migrations / repositories / launch docs (#130–#135, #146)
