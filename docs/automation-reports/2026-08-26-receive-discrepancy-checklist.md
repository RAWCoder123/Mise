# Receive discrepancy checklist (2026-08-26)

Branch tip implements a fresh receive-discrepancy checklist on current `origin/main`
(`20b28e5`), superseding the stale conflicted draft #134 for this workflow.

## Closed

- Operators can review each receivable line before recording a supplier delivery.
- Short-ships derive missing quantity; damage and optional discrepancy notes are
  validated before submit.
- Unknown inventory item IDs in adjustments are rejected (no invented lines).
- Demo repository persists `discrepancy_reason` on delivery items.
- EN / ES / zh-Hans copy for the checklist, validation, and empty/error states.

## Paths

- `services/domain/supplierDelivery.ts`
- `services/application/deliveries.ts`
- `services/repositories/demoRepository.ts`
- `services/demo/replaceableDemoData.ts`
- `app/orders/[id].tsx`
- `i18n/catalog.ts`
- `tests/supplierDeliveryDiscrepancy.test.ts`
- `tests/ordersUi.test.ts`

## Do not redo

- Silent as-ordered-only receive submit without a line review path.
- Inventing receivable lines for unknown inventory item ids.
- Soft-delete or rewrite of historical delivery evidence.
