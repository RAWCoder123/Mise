# Inventory adjustment ledger (2026-09-02)

## Summary

Managers can record signed inventory ledger `adjustment` events from More → Adjust inventory. Ordinary count/receipt/waste/stockout paths stay non-negative-only; waste supersession remains a separate correction flow.

## Why

The hosted `record_inventory_event` RPC already accepts `adjustment` for owner/admin/manager, and demo projection already applies signed deltas. Client validation hard-blocked `adjustment`, so operators could only approximate corrections via full counts, waste, or stockout-to-zero.

## Changes

- Domain helpers for direction ↔ signed quantity and bounded reason codes
- `requireInventoryAdjustment` + `queueInventoryAdjustment` (required note, non-zero signed qty, no supersedes)
- More hub screen with item search, increase/decrease, reason chips, fail-closed hub gating
- EN / ES / zh-Hans copy; route smoke + hub/tenant safety pins

## Non-goals

- Waste correction via `supersedesEventId` (open stack elsewhere)
- Staff-role adjustments (RPC remains manager+)
- Editing contested `app/inventory/[id].tsx`

## Verification

- `npm run typecheck`
- `npm test` (inventoryAdjustment* + hub/tenant pins)
- `npm run security:static`
- `npm run design:static`
