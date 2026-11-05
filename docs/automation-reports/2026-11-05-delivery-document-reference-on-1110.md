# Supplier delivery document reference (stacked on #1110)

Date: 2026-11-05  
Branch: `cursor/mise-delivery-document-reference-on-1110`  
Base: `cursor/mise-send-order-lines-fingerprint-main-rebase` (#1110 tip)

## Summary

Fresh reimplementation of optional invoice/PO `document_reference` capture on
receive paths. Does not resume `cursor/mise-product-inspection-fc1c` (#381)
wholesale; the idea was re-evaluated against the current receive/send stack and
implemented as a narrow tip stacked after durable order lines and send
fingerprints.

## What changed

- Additive migration `20261105100000_supplier_delivery_document_reference.sql`
  after `20261105090000` send-fingerprint.
- Bounded `supplier_deliveries.document_reference` (1–80, trimmed) with
  `[[:cntrl:]]` rejection pinned to `COLLATE "C"` from day one (MISE-005A).
- Wrapper around current `record_supplier_delivery` preserves manager role
  gates, tenant checks, and SELECT-only client grants.
- Document identity attaches only on `outcome = applied` so replays stay
  idempotent.
- Orders Mark Received, Log Delivery, and inventory Receive capture optional
  Invoice/PO; ad-hoc receipts reuse ledger `sourceReference` without overloading
  order-delivery idempotency UUIDs.
- Demo deliveries include sample document references; EN/ES/zh-Hans copy added.

## Explicitly not invented

- MOQ, lead time, expiration, invoice totals, or cost apply
- Fuzzy document matching
- Changing `mise.supplier_send.v2` or durable order-line authority

## Verification

- `npm run typecheck`
- focused document-reference + delivery-history + reliability tests
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- Docker pgTAP not run in this environment
