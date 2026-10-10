# MISE-005MI deliveries clientDeliveryId ASCII C

Date: 2026-10-10  
Branch: `cursor/mise-deliveries-client-ascii-c`  
Base: `origin/main` @ `78da737`

## Change

Pins deliveries application `receiveSupplierOrderDelivery` optional
`clientDeliveryId` to ASCII-only end trim so NBSP/em-space padding cannot invent
a normalized client-delivery identity before receive writes.

- Adds `services/domain/deliveriesClientDeliveryIdentity.ts` with fail-closed
  canonicalize / require / optional-resolve helpers.
- Routes `options.clientDeliveryId` through
  `resolveCanonicalDeliveriesClientDeliveryId`, preserving generated fallback
  when the optional token is omitted or ASCII-empty.
- Introduces stable `Missing client delivery id.` for inventing / invalid tokens.
- Leaves restaurant workspace on Unicode trim (owned by #748 / MISE-005LR).
- Leaves `supplierOrderId.trim()` on Unicode trim (owned by #760 / MISE-005MD).
- Non-UUID demo tokens intentionally preserved (no UUID shape gate).
- Max length 200 matches hosted `supplier_deliveries.client_delivery_id`.

## Merge note

When landing with #748 and #760, keep restaurant, supplier-order, and
client-delivery branches in `deliveries.ts`. Drop any assertion that
`clientDeliveryId` still uses Unicode `options.clientDeliveryId?.trim()`
(#760 currently asserts that). #748 owns restaurant; #760 owns supplier order;
this tip owns client delivery.

## Verification

- `tests/deliveriesClientDeliveryAsciiC.test.ts`: focused inventing proofs
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

## Do not

- Re-tip this deliveries clientDeliveryId path after merge.
- Bundle restaurant (#748) or supplierOrderId (#760) in the same PR.
- Rewrite restaurant `restaurantId.trim()` or supplier-order trim in this tip.
- Add UUID shape requirement on this object path (demo may use non-UUID tokens).
