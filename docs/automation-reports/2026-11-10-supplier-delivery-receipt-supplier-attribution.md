# Supplier delivery receipt durable supplier attribution

Date: 2026-11-10  
Baseline: `origin/main` @ `78da7376`

## Problem

Order-path Mark Received writes `inventory_events` with `source = supplier_delivery` and free-text `supplierName` in metadata, but not the durable `supplier_orders.supplier_id`. Ad-hoc Log Delivery attribution (#1241) intentionally left this path alone. Purchasing and learning therefore cannot attribute order-path receipts after a supplier rename without inventing identity from display text.

## Change

- Domain helper `services/domain/supplierDeliveryReceiptAttribution.ts` stamps/validates `metadata.supplier_id` from the order’s durable supplier id and soft-reads it for later surfaces.
- Additive BEFORE INSERT trigger `private.stamp_supplier_delivery_receipt_supplier_attribution` resolves `metadata.supplierOrderId` → `supplier_orders.supplier_id`, stamps the ledger row, and fail-closes missing/invalid/mismatched ids.
- Demo `recordSupplierOrderDelivery` requires `order.supplier_id` and stamps the same id on the delivery audit metadata (hosted MISE-003C already stamps audits).

Intentionally unchanged: `record_supplier_delivery` / `record_inventory_event` signatures, operator_receipt path, receive UI, canonical quantity conversion (#392), and discrepancy/line-receive tips (#670/#1109/#1111).

## Verification

- `npm run typecheck`
- `npm run security:static`
- `npm run design:static`
- Focused: `tests/supplierDeliveryReceiptAttribution.test.ts` + `tests/supplierDeliveryReceiptAttributionMigration.test.ts` (8/8 pass)
- Assertion call sites counted from source: **52**

## Alone-OK

Does not redeclare contested receive RPCs. Separate trigger from #1241’s operator_receipt validator. Demo edit is limited to `recordSupplierOrderDelivery` audit/identity checks.
