# Receive from durable supplier order lines (2026-08-27)

## Completed
- Receive builds as-ordered quantities from `supplier_order_lines` snapshots instead of live purchase recommendations.
- Missing durable lines fail closed (`SupplierOrderLinesMissingError`); no silent recommendation rebuild.
- Unverified canonical units fail closed (`SupplierDeliveryLinesSkippedError`); no unverified fallback and no silent partial receive.
- Order detail surfaces EN/ES/zh-Hans notices with Inventory recovery for unverified units.
- Domain + static pins cover quantity freeze, fail-closed asserts, and application-path contracts.

## Paths
- `services/domain/supplierDelivery.ts`
- `services/application/deliveries.ts`
- `app/orders/[id].tsx`
- `i18n/catalog.ts`
- `tests/supplierDeliveryOrderLinesReceive.test.ts`
- `docs/pilot/FIRST_RESTAURANT_GAP_AUDIT.md`
- `docs/automation-reports/2026-08-27-receive-order-lines.md`

## Stacking
- Branched from `cursor/mise-supplier-order-lines` (#196).
- Incorporates the receive fail-closed verified-unit contract from #184 on the durable-line path.
- Does not implement #182 discrepancy checklist UI (received/damaged/missing editing).

## Intentionally deferred
- Authoritative order totals (still blocked when costs are incomplete).
- Send fingerprint expected body lines preferring durable snapshots (same family, separate tip).
- Purchase-loop → recommendation policy feed after authority gates.

## Next
1. Land/rebase #130–#196 stacks onto main without duplicating gates.
2. Optional: point supplier send content validation at durable lines.
3. Optional 004B: bounded purchase-loop/decision-pattern influence after readiness gates stay closed.

## Verification
- `npm run typecheck`
- `node --import tsx --test tests/supplierDeliveryOrderLinesReceive.test.ts`
- `npm test`
- `npm run security:backend` when feasible
