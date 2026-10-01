# Supplier delivery document reference (2026-09-03)

Branch tip for this automation run. Base: `origin/main` @ `20b28e5`.

## Gap

Operators cannot reconcile receives to vendor invoices or purchase-order numbers.
`supplier_deliveries` stored only freeform `notes`, and Mark Received collected
nothing. Ad-hoc Log Delivery / inventory Receive never set ledger
`sourceReference` even though validation already supported it.

## Fix

1. Migration `20260903220000_supplier_delivery_document_reference.sql` adds
   bounded `document_reference` and wraps `record_supplier_delivery` with
   optional `p_document_reference` (applied receives only; ledger
   `source_reference` stays the delivery UUID).
2. Domain `normalizeOptionalDocumentReference`, reliability evidence,
   demo/hosted repositories, and Orders Mark Received UI.
3. Log Delivery + inventory Receive capture invoice/PO via
   `sourceReference` for ad-hoc receipts; history surfaces it when source is
   `operator_receipt`.
4. EN / ES / zh-Hans catalog keys.

## Verification

- `npm run typecheck`
- focused document-reference + delivery-history + supplier-reliability tests
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Notes

- Distinct from #295 invoice totals / line prices and #369 ad-hoc unit cost.
- Does not invent MOQ, lead time, or expiration.
- Hosted deploy of the additive migration remains an ops step.
