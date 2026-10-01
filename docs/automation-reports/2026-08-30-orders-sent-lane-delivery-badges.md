# Orders sent-lane delivery attention badges (2026-08-30)

## Completed
- Indexed latest supplier delivery evidence per order for the Orders hub.
- Sent and History `SupplierDraftCard` rows now replace the generic Sent/Received
  badge with Partial / Discrepancy / Failed when verified receipt evidence exists.
- Attention line count copy surfaces when discrepancy lines are present.
- Sent lane tab badge shows attention count when any sent order needs review;
  otherwise shows total sent count. History lane now shows a count badge.
- EN / ES / zh-Hans catalog keys for accessibility and attention copy.

## Workflows
- Operator can scan Sent/History lanes for partial or discrepant deliveries
  without opening each order detail.
- Badges remain grounded in `supplier_deliveries` / delivery item evidence;
  no invented status.

## Tests
- `npm run typecheck` — pass
- `npx tsx --test tests/supplierReliability.test.ts tests/ordersUi.test.ts` — 16/16
- `npm test` — 635 passed, 0 failed, 7 cancelled

## Paths
- `services/domain/supplierReliability.ts`
- `services/application/orders.ts`
- `components/SupplierDraftCard.tsx`
- `app/(tabs)/orders.tsx`
- `i18n/catalog.ts`
- `tests/supplierReliability.test.ts`
- `tests/ordersUi.test.ts`

## Not done / next
- Land/rebase open stacks (#187–#287).
- Verified `supplier_items.pack_quantity` → recommendation pack rounding (needs catalog verify path).
- Invitee Auth bootstrap remains founder-policy deferred.
