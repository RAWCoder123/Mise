# Inventory safety stock (2026-11-05)

## Summary

Managers can set `safety_stock` on inventory items. When projected on-hand falls at or below a binding safety buffer (`max(reorder_threshold, safety_stock)`), Mise surfaces a reorder recommendation and Low status without inventing orders when stock is healthy.

## Changes

- Additive migration `20261105190000_inventory_safety_stock.sql` (default 0 preserves prior behavior)
- Extends service-owned inventory policy patch allowlist + Edge validation
- Domain helpers: safety stock of 0 keeps reorder-threshold-only triggers; hard stockouts stay Critical
- Inventory detail settings + EN/ES/zh-Hans; demo defaults for a few protein/produce items
- Does not change purchase approval, supplier-send authority, lead time/MOQ (#1116), shelf life (#1117), or pack rounding (#1106)

## Why

Restaurants need an explicit safety buffer distinct from the reorder threshold so managers can raise the trigger without changing par or suggested restore-to-par quantities.

## Verification

- `npm run typecheck`
- Focused `tests/inventorySafetyStockPolicy.test.ts`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- pgTAP source at `supabase/tests/database/inventory_safety_stock.test.sql`

## Deploy

Apply additive migration `20261105190000_inventory_safety_stock.sql` before relying on hosted safety-stock policy patches.
