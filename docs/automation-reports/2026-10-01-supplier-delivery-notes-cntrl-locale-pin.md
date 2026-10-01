# MISE-005EO supplier delivery notes/discrepancy_reason cntrl locale pin

Date: 2026-10-01

## Change

CHECK-only replace of:

- `supplier_deliveries_notes_bound_check` — keep `length(notes) <= 2000`, add
  `notes collate "C" !~ '[[:cntrl:]]'`
- `supplier_delivery_items_reason_bound_check` — keep
  `length(discrepancy_reason) <= 500`, add
  `discrepancy_reason collate "C" !~ '[[:cntrl:]]'`

Client validators `requireSupplierDeliveryNotes` and
`requireSupplierDeliveryDiscrepancyReason` reject the same ASCII C control set
(`U+0000–U+001F`, `U+007F`) before a round-trip. The receive application path
normalizes delivery notes through the notes validator.

## Why

Both CHECKs had length only and no control-character gate. Delivery notes and
discrepancy reasons are durable free-form operator text on the supplier-delivery
ledger. Sibling MISE-005 tips pin text CHECKs under `COLLATE "C"` so
dump/restore cannot accept bytes a restored C-locale path would refuse.

## Out of scope

- `record_supplier_order_delivery` / delivery RPC rewrites
- delivery status vocabulary
- inventory count notes (#552)
- supplier_orders.operator_note (#551)
- insight body bounds (#550)

## Verification

- `npm run typecheck` — passed
- focused `supplierDeliveryNotesCntrlLocalePin` tests: 5/5 pass
- `npm test`: 681 pass / 0 fail / 7 cancelled
- pgTAP plan **16** counted from 16 assertion call sites in
  `supplier_delivery_notes_cntrl_locale_pin.test.sql`
