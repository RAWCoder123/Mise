# Inventory correction exact reverse (2026-09-04)

## Summary
Linked inventory `correction` events must use the exact reverse quantity (and
matching canonical unit) of a correctable superseded movement. Free-form signed
deltas under a correction label are rejected in domain `acceptInventoryEvent`
and at every hosted `inventory_events` insert path.

## Why
`record_inventory_event` already validated that a supersede target exists and
belongs to the same item, but it accepted any correction quantity. Managers could
inflate or deflate on-hand while appearing to repair a specific row. Product
flows (#345 waste correction, #350 receipt correction) already stamp exact
reverses; this tip makes that contract fail closed.

## Correctable targets
- `receipt`, `adjustment`, `transfer` → correction quantity = `-superseded.quantity`
- `waste`, `usage` → correction quantity = `+superseded.quantity`
- `count`, `stockout`, `correction` → not reversible via signed delta

## Verification
- `npm run typecheck`
- focused domain + migration pin tests
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run supabase:test` (Docker may be unavailable)

## Notes
- Additive migration `20260904130000_inventory_correction_exact_reverse.sql`
  does not redeclare `record_inventory_event`, so it composes with #394 and
  sibling ledger integrity stacks.
- Does not invent MOQ / lead_time / expiration.
- Distinct from orphan-supersede-required (#394) and zero-quantity (#374).
