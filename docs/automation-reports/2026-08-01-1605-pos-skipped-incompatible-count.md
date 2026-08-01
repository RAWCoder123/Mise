# Hosted POS skipped_incompatible_count (2026-08-01)

Branch: `cursor/mise-product-inspection-81cb`  
Base tip: fast-forwarded from `origin/cursor/mise-product-inspection-bb73` (`41fcbd0`)

## Completed

1. Carried forward the private-beta tip onto this run’s branch.
2. Hosted POS recipe consumption now reports unit-incompatible skips separately from unmapped sales:
   - `private.apply_recipe_consumption_for_sales` returns `skipped_incompatible_count`.
   - `private.service_ingest_manual_pos_sales` includes the count in the ingest summary and audit metadata.
   - Missing inventory links and unit mismatches both increment the skip counter (aligned with the demo planner).
   - Compatible mappings still deduct inventory; fully incompatible sales remain counted as unmapped.
3. Added pgTAP coverage in `pos_consumption_skipped_incompatible.test.sql`.
4. Extended security static gates and demo ingest unit coverage.

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
- Hosted and demo POS CSV ingest now share the same incompatible-skip summary field.

## Next highest-priority implementable work

1. Regenerate `supabase/schema.sql` when Docker is available.
2. Ops blockers unchanged: hosted/Docker re-proof, Auth redirect allowlist, founder privacy/support URLs, Apple/EAS/device QA.
