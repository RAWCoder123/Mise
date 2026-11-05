# Per-line receive put-away (rebased 2026-11-05)

## Gap
`#1101` / `#219` already applied a single shared put-away station to every
supplier-order receive line. Demo and hosted SQL already honored per-line
`storageLocationId`, but the UI and delivery-line builder stamped one station
onto the whole delivery.

## Change
Rebased onto `cursor/mise-receive-waste-station-attribution-main-rebase`
(#1101 on #1100). Supersedes the stale stack of #234 on #219.

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
- `npm test` — focused putaway + orders UI contracts; full suite when deps ready
- `npm run security:static`
- `npm run security:backend`

## Notes
Does not wholesale resume closed #70. Quantity editing / discrepancy checklist /
durable order-line receive remain on their own stacks (#182/#184/#196–#198).
Do not re-tip #234; use this main-rebase tip instead.
