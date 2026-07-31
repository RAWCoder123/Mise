# Manager correction ledger + direct inventory write disable

Date: 2026-07-31  
Branch: `cursor/mise-product-inspection-4a6b`

## Problem

1. Single-item inventory quantity edits through `update_inventory` wrote ledger rows as `manual_count`, colliding with multi-item count-session approvals and opening stock creates. The UI already had a `manager_correction` label, but no write path used it.
2. The hosted Supabase repository still exposed a direct Data API `updateInventoryItem` method even though authenticated DML on `inventory_items` is revoked and screen-facing code uses `updateInventoryItemAndSignals`.

## Change

- Migration `20260731080000_manager_correction_ledger_reason.sql` retags quantity deltas from `service_update_inventory_and_signals` as `manager_correction` / `update_inventory`.
- Demo repository mirrors the same reason for quantity patches.
- Hosted `updateInventoryItem` now throws closed, matching upsert/POS direct-write guards.
- `supabase/schema.sql` banner strengthened with `SCHEMA_SQL_IS_LEGACY_SNAPSHOT=1` and an explicit do-not-apply warning (migrations remain authoritative).
- Operator copy updated so Save Inventory / success messaging describe corrections, not count sessions.

## Verification

- Unit/security contract tests cover migration reason, hosted throw path, and schema legacy marker.
- pgTAP expects `manager_correction` on the single-item update path (Docker proof still required in environments with Supabase CLI).
- `npm run typecheck` and `npm test` on this branch.
