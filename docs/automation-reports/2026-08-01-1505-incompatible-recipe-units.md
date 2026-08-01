# Incompatible recipe/unit repair path (2026-08-01)

Branch: `cursor/mise-product-inspection-bb73`  
Base tip: fast-forwarded from `origin/cursor/mise-product-inspection-45f5` (`ff5aaa3`)

## Completed

1. Carried forward the private-beta tip onto this run’s branch.
2. Surfaced unit-incompatible recipe mappings distinctly from unmapped POS sales:
   - `buildRecipeBaselineSummary` now flags `posItemsWithIncompatibleUnits` and per-ingredient `unitCompatible` / `inventoryUnit`.
   - Today emits `repair_incompatible_recipe_units` with presentation `today.recipe.repair_incompatible_units`.
   - Incomplete setup `recipes` step is suppressed when unmapped or incompatible repair tasks exist.
   - Settings recipe row prefers incompatible-unit messaging over unmapped when both apply.
   - Recipes screen warns and highlights mismatched links; Save / Fix unit aligns the recipe unit to the inventory unit.
   - POS CSV import reports `skippedIncompatibleCount` (demo) and offers a repair CTA.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:backend`
- `npm run security:static`
- `npm run design:static`

Not run here: Docker `supabase:test`, hosted staging gates, device/TestFlight QA.

## Current product state

- Controlled pilot / private-beta code path continues to harden.
- Live Square/Toast/Clover sync and live Gmail send remain credential-gated fail-closed.
- Hosted SQL still folds fully-incompatible sales into `unmapped_sale_count`; durable operator repair uses baseline detection.

## Next highest-priority implementable work

1. Optional SQL migration to return `skipped_incompatible_count` from hosted POS consumption.
2. Regenerate `supabase/schema.sql` when Docker is available.
3. Ops blockers unchanged: hosted/Docker re-proof, Auth redirect allowlist, founder privacy/support URLs, Apple/EAS/device QA.
