# Unmapped POS recipe repair path (2026-08-01)

Branch: `cursor/mise-product-inspection-d206`  
Base tip: fast-forwarded from `origin/cursor/mise-product-inspection-2470` (`b7994cb`)

## Completed

1. Carried forward prior private-beta tip (sole-owner account deletion, inventory health stations, Edge team/supplier workflows, POS consumption, etc.).
2. Surfaced sold-but-unmapped POS menu items as an actionable repair path:
   - Today emits `map_unmapped_pos_items` with presentation `today.recipe.map_unmapped`, deep-linking to `/settings/recipes` and prefilling a sample menu item.
   - Incomplete setup `recipes` step is suppressed when the dedicated repair task is present to avoid duplicates.
   - Settings always exposes POS/CSV (demo and hosted) instead of a dead-end live quiet row.
   - Settings recipe row shows unmapped count badge/subtitle from `fetchRecipeBaselineSummary`.
   - POS CSV import reports unmapped sales and offers a direct Map CTA.
   - Recipes accepts `menuItem` query param to prefill the builder.

## Verification

- `npm run typecheck`
- `npm test` (261 passing)
- `npm run security:backend`
- `npm run security:static`
- `npm run design:static`
- `npm run qa:routes`

Not run here: Docker `supabase:test`, hosted staging gates, device/TestFlight QA.

## Current product state

- Controlled pilot / private-beta code path continues to harden.
- Live Square/Toast/Clover sync and live Gmail send remain credential-gated fail-closed.
- CSV POS ingest + recipe consumption remain the supported non-demo sales path.

## Next highest-priority implementable work

1. Edge-route remaining authenticated profile mutation RPCs (`update_my_profile`, `update_restaurant_profile`, locale preference writes) that still bypass the Edge firewall.
2. Regenerate `supabase/schema.sql` when Docker is available.
3. Ops blockers unchanged: hosted/Docker re-proof, Auth recovery redirect allowlist, founder privacy/support URLs, Apple/EAS/device QA.
