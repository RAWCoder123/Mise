# Close undelivered sent supplier orders (2026-09-02)

## Problem

Sent supplier orders with zero delivery evidence had no honest exit: Mark
received posts as-ordered inventory, while leaving the order `sent` keeps
Home/Today chase tasks open. Short-accept close (#286) requires prior
deliveries; draft cancel (#282) only covers drafts.

## Fix

1. Domain `services/domain/supplierOrderUndeliveredClose.ts` — bounded reasons,
   gate helper (`sent` + zero prior deliveries).
2. Hosted RPC `complete_supplier_order_undelivered` (manager+, supplier
   authority lock, activity + audit, no inventory receipt).
3. Application `closeSupplierOrderUndelivered` with demo/hosted repository
   parity.
4. Order detail CTA when sent and delivery evidence is empty; Alert reason
   picker; EN/ES/zh-Hans.

## Verification

- `npm run typecheck`
- Focused undelivered-close suites
- `npm test`
- `npm run security:static`
- `npm run design:static`

## Non-goals

- Does not invent MOQ / lead_time / expiration
- Does not restore ordered recommendations to pending
- Does not replace #286 short-accept (prior deliveries) or #282 draft cancel
- Does not change receive writers
