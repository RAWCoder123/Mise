# Create Task prerequisite ranked search (2026-08-29)

## Gap
More → Create Task hard-capped open shared-task prerequisites at `slice(0, 12)` with no find. Busy restaurants can have more open shared tasks than that cap.

## Fix
- Domain: `services/domain/restaurantTaskDependencySearch.ts` — `filterRestaurantTaskDependenciesBySearch` + threshold 8; title/status/category/supplier/detail ranking; id dedupe; blank-title skip.
- UI: `app/more/create-task.tsx` — search when open shared tasks >8; showing X of Y + empty copy; query resets on restaurant change; removes the hard 12-item slice.
- i18n EN/ES/zh-Hans `operatorTasks.dependency.search.*`.
- Unit + UI static pin in `tests/restaurantTaskDependencySearch.test.ts`.

## Out of scope
Does not change shared-task create/complete RPCs, dependency cycle rules, or open stacks #132–#247 / #147.

## Verification
- `npm run typecheck`
- focused dependency search tests
- `npm test`
- `npm run design:static` / `npm run security:static` when available
