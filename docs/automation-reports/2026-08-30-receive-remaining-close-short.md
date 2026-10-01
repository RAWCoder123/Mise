# Receive remaining + accept-short close (2026-08-30)

## Problem

Partial or discrepancy supplier deliveries leave `supplier_orders.status = sent`.
A second Mark received rebuilt full as-ordered lines with a new
`clientDeliveryId`, so follow-up receives re-posted inventory already accepted
(or marked missing). Operators were stuck between perpetual open receive work
and inflated on-hand stock. Open stacks (#182 discrepancy checklist, #204 keep
receive tasks open) make this gap worse once landed.

## Fix

1. Domain netting in `services/domain/supplierDelivery.ts`:
   - `sumPriorDeliveryCoverage`
   - `buildRemainingDeliveryLines` (ordered − received − missing)
   - `buildSupplierOrderReceiveOutlook` / `canCloseSupplierOrderAcceptingShort`
2. Application `receiveSupplierOrderDelivery` loads prior delivery history and
   posts only remaining lines; fail-closed `SupplierOrderReceiveBlockedError`
   when nothing remains.
3. `closeSupplierOrderAcceptingShort` completes a still-sent order after prior
   delivery evidence without writing inventory.
4. Hosted RPC `complete_supplier_order_accepting_short` (manager+, audit +
   activity, supplier authority lock). Demo parity in `demoRepository`.
5. Order detail: Receive remaining vs Close order (accept short), EN/ES/zh-Hans.

## Verification

- `npm run typecheck`
- `npm test` (644 / 637 pass / 0 fail / 7 cancelled)
- Focused: `tests/supplierOrderReceiveRemaining.test.ts`,
  `tests/supplierOrderReceiveRemainingWorkflow.test.ts`
- `npm run security:static`
- `npm run security:backend`

## Not duplicated

Does not redo #182 first-receive checklist, #197 durable order lines, #232
completed ordered-vs-received display, #267 Log Delivery guard, #204 Today
receive tasks, or #280–#285 inventory/cancel/return/undo/ledger stacks.
