# Inventory count sessions (ledger path)

## Summary

Multi-item inventory count sessions are now available on the Mise tip with staff draft/submit flows and manager approval that writes append-only `inventory_events` (`event_type = count`) instead of `inventory_movements` or direct `current_quantity` updates.

## Backend

- Migration `20260810140000_inventory_count_sessions_ledger.sql` adds `inventory_count_sessions` and `inventory_count_lines` (SELECT-only for authenticated clients).
- Service RPCs: begin, save_lines, submit, cancel, get, approve.
- Begin only includes items with verified canonical conversion so approve cannot fail after staff has already counted.
- Approve inserts canonical `inventory_events` with stable idempotency keys `count_session:{session_id}:{item_id}` and skips unchanged lines.
- `private.edge_function_policy` now allows `staff` on `operational-workflows` while preserving all other Edge function rows.

## App

- Domain: `services/domain/inventoryCountSessions.ts`
- Application APIs exported via `services/application/inventory.ts` / `miseService`
- Repositories: `supabaseRepository` (Edge mutations + SELECT open session), `demoRepository` (full parity via `recordInventoryEvent`)
- UI: `/inventory/count` screen and inventory hub entry when `hubReady && canDraft`
- Today tasks prefer count sessions and suppress per-item count shortcuts when stock-risk items exist

## Verification

- `npm run typecheck`
- `npm test` — 488 pass / 0 fail (7 pre-existing recalculation timeout cancels)
- `npm run security:backend` and `npm run security:static`
- `npm run design:static` and `npm run qa:routes` (includes `/inventory/count`)
