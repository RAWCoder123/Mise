# Mapped recipe dish ranked search (2026-08-02)

## Gap
Settings → Recipes loaded the full mapped-dish list (`itemLimit: null`) but offered no find control. Operators hunting one dish to edit quantity, fix units, or unlink had to scroll, slowing recipe-coverage repair that drives POS depletion accuracy.

## Change
- Domain: `filterRecipeBaselineItemsBySearch` + `RECIPE_BASELINE_SEARCH_THRESHOLD` (5) in `services/domain/inventoryItemSearch.ts`.
- Matches dish name and linked ingredient names via existing ranked inventory search scoring.
- UI: search field on `/settings/recipes` when mapped dishes ≥ threshold; empty-match state; section count reflects filtered results.
- i18n: EN / ES / zh-Hans for accessibility, hint, placeholder, and empty copy.
- Tests: unit coverage in `inventoryItemSearch.test.ts`; security static contract for screen + domain + catalog wiring.

## Verification
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`

Docker `supabase:test` and hosted staging re-proof remain environment-blocked in this run.
