# Staff inventory waste on the ledger RPC (2026-08-27)

## Completed
- Additive migration allows active `staff` to call `record_inventory_event` only when `p_event_type = 'waste'`.
- Count/receipt/stockout/adjustment/transfer/correction/usage remain owner/admin/manager.
- Domain + tenantAccess `canRecordInventoryWaste`.
- Inventory detail: staff see waste-only ops; managers keep full ops/par/order.
- Inventory list: staff tip focuses search to find an item.
- EN/ES/zh-Hans catalog keys for limited access, waste tip, and waste submit.
- Unit + security pins + pgTAP `staff_inventory_waste.test.sql`.

## Why
Kitchen staff observe spoilage first. On main they were view-only for ledger ops, so waste under-reported and Waste Analysis stayed blind.

## Verification
- `npm run typecheck`
- focused inventoryWaste + security role pins
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- Hosted/Docker pgTAP when available

## Classification
Controlled pilot readiness improvement. Not App Store submission-ready.
