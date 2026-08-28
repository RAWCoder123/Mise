# Per-line receive put-away (2026-08-28)

## Gap
`#219` already applied a single shared put-away station to every supplier-order
receive line. Demo and hosted SQL already honored per-line
`storageLocationId`, but the UI and delivery-line builder stamped one station
onto the whole delivery.

## Change
Stacked on `cursor/mise-receive-waste-station-attribution` (#219 / #215).

- Domain: `resolveDeliveryLineStorageLocationId` + per-line map on
  `buildDeliveryLinesFromOrderRecommendations`.
- Application: `receiveSupplierOrderDelivery` accepts
  `storageLocationIdsByItemId` with shared default fallback.
- UI: default put-away chooser; when the send payload has 2+ lines, each line
  gets an override chooser. Changing default clears overrides that still matched
  the previous default.
- i18n EN / ES / zh-Hans for default and line labels.
- Tests: `tests/supplierDeliveryPutaway.test.ts` + orders UI contract pin.

## Verification
- `npm run typecheck`
- `npm test` — 653 pass / 0 fail / 7 cancelled
- `npm run security:static`
- `npm run security:backend`

## Notes
Does not wholesale resume closed #70. Quantity editing / discrepancy checklist /
durable order-line receive remain on their own stacks (#182/#184/#196–#198).
