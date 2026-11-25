# Fail closed forged supplier_delivery receipt sources

Date: 2026-11-25  
Baseline: `origin/main` @ `78da7376`  
Scout: [Scout alone-OK product gaps](bc-06d48100-1a04-5259-99fe-809145c5b02a)

## Gap

Managers could call `record_inventory_event` with `event_type=receipt` and
`source=supplier_delivery` without naming a same-tenant delivery row. That
privileged label suppressed Activity, falsified order-path provenance, and still
moved on-hand.

## Change

- Domain rejects `receipt` + `source=supplier_delivery` without a UUID
  `sourceReference` (`invalid_supplier_delivery_reference`)
- Additive BEFORE INSERT trigger requires that UUID to exist on
  `supplier_deliveries(restaurant_id, id)`
- Demo `recordInventoryEvent` mirrors the existence check as a terminal reject
- Transport maps the hosted `22023` message ahead of generic matchers
- pgTAP covers missing/non-UUID/unknown/cross-tenant reject and linked accept

## Out of scope

- Count-session provenance (#388/#393)
- Supplier_id stamps (#1241/#1243) and receipt path labels (#1244)
- Receive discrepancy / FEFO stacks
- Purchase-line invents (#1238/#1250–#1258)

## Verification

- `npm run typecheck`
- Focused provenance + ledger + transport tests
- `npm test`
- `npm run security:static`
- `npm run security:backend`
