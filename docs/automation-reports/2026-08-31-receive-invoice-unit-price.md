# Receive invoice total + unit price capture (2026-08-31)

Branch tip implements optional supplier invoice total and per-line unit price
capture on the sent-order receive path, grounded in the existing hosted
`record_supplier_delivery` contract (`p_invoice_total`, line `unitPrice`).

Base: `origin/main` @ `20b28e5`.

## Closed

- Managers can optionally enter an invoice total and per-line unit prices before
  marking a sent supplier order received.
- Unknown ordered-item IDs and out-of-bound amounts fail closed.
- Demo repository persists `invoice_total` and `unit_price`.
- Hosted delivery history SELECT includes `invoice_total` and `unit_price`.
- Delivery evidence surfaces invoice total and priced-line counts when present.
- EN / ES / zh-Hans copy for the cost panel, validation, and evidence.

## Paths

- `services/domain/supplierDelivery.ts`
- `services/domain/supplierReliability.ts`
- `services/application/deliveries.ts`
- `services/miseValidation.ts`
- `services/repositories/demoRepository.ts`
- `services/repositories/supabaseRepository.ts`
- `services/demo/replaceableDemoData.ts`
- `app/orders/[id].tsx`
- `i18n/catalog.ts`
- `tests/supplierDeliveryReceiveCosts.test.ts`

## Notes

- Contested with open receive stacks (#182/#197/#234/#286/#293); expect rebase.
- Quantity discrepancy checklist remains owned by #182; this slice is cost-only.
- No migration; RPC already validates and stores these fields.
