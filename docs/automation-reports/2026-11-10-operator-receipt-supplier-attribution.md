# Operator receipt durable supplier attribution (2026-11-10)

## Summary

Ad-hoc Log Delivery / Inventory-detail receives (`source = operator_receipt`) now
carry the inventory item's durable `supplier_id` in `inventory_events.metadata`.
Hosted and demo repositories stamp the authoritative identity before the ledger
write so idempotent retries compare equal metadata. An additive BEFORE INSERT
trigger fail-closes any operator_receipt row that lacks a matching supplier UUID.

## Why

Without durable supplier attribution, ad-hoc receipts cannot feed purchasing
memory, supplier reliability, or purchase-line learning. Free-text notes are not
authority. MISE-003C already made `inventory_items.supplier_id` required; this tip
binds that identity onto the receipt evidence at record time.

## Scope

- In: operator_receipt receipts only
- Out: supplier_delivery order-path receives, UI history display, miseValidation /
  Log Delivery screen edits (alone-OK vs #1237/#1239), RPC rewrites

## Verification

- `npm run typecheck`
- Focused: `tests/receiptSupplierAttribution.test.ts`,
  `tests/receiptSupplierAttributionMigration.test.ts`
- Assertion call sites counted from source: **53** (domain + migration pin + demo path)
