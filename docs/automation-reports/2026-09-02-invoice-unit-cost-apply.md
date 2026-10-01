# Apply invoice unit cost from delivery (2026-09-02)

## Summary
Managers can apply a received supplier-delivery line's invoice `unit_price`
onto the matching inventory item's `estimated_unit_cost`, so order automation,
valuation, and waste cost stop using a stale estimate after invoice evidence
exists.

## Why
Hosted `record_supplier_delivery` already stores optional line `unit_price`,
but nothing copied that evidence into `inventory_items.estimated_unit_cost`.
Manual cost edit (`#231`) and receive-price capture UI (`#295`) remain separate
open stacks; this slice applies existing priced delivery evidence without
inventing MOQ/lead time/expiration.

## Implementation
- Domain helpers: propose/select apply candidates; refuse cross-tenant,
  zero-received, missing/invalid prices, and already-applied costs.
- Additive RPC `apply_invoice_unit_cost_from_delivery` (owner/admin/manager,
  `auth.uid()`), activity (`supplier_prices_checked`) + audit evidence.
- Delivery history reads now include `unit_price`; demo seeds priced rice and
  pancake-mix lines; demo/hosted repository parity; post-apply signal refresh.
- Inventory detail CTA when a candidate exists; EN / ES / zh-Hans copy.

## Verification
- `npm run typecheck`
- Targeted invoice unit-cost suites
- `npm test`
- `npm run security:static`
- `npm run design:static`

## Notes
- Hosted tenants need the additive migration deployed before the apply RPC works.
- Capturing new invoice prices on receive remains `#295`; general manual cost
  edit remains `#231`.
