# Today unmapped POS recipe repair (2026-08-26)

## Summary

Sold POS menu items without dish-to-stock recipes never deplete inventory.
Today now surfaces a manager recipe-repair task from the same
`posItemsMissingRecipes` evidence used by Recipes, routes into Recipes with an
optional `menuItem` prefill, and suppresses the duplicate generic setup recipes
step while the sold-POS gap remains open.

## Paths

- `services/domain/todayTasks.ts`
- `services/domain/operatingPlan.ts`
- `services/application/today.ts`
- `services/application/operatingPlan.ts`
- `services/presentation/operationsPresentation.ts`
- `types/presentation.ts`
- `app/settings/recipes.tsx`
- `app/tasks/[id].tsx`
- `components/operations/OperatingPlanTimeline.tsx`
- `i18n/catalog.ts`
- `tests/todayTasks.test.ts`
- `tests/operationsPresentation.test.ts`
- `tests/todayUnmappedPosRecipeRepairUi.test.ts`

## Verification

- `npm run typecheck`
- focused pins + `npm test`
