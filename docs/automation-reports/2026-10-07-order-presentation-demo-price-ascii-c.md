# MISE-005KH: pin orderPresentation demo price identity to ASCII C

## Summary

`utils/orderPresentation.ts` still estimated demo supplier-draft line prices with
Unicode-aware `toLowerCase`. Sibling tip #701 (Inventory categoryIcon) and the
post-#702 gap note explicitly deferred this free-form demo price heuristic.
Under Unicode case folding, a Kelvin sign (`K`) becomes `k`, which invents a
`chicken` unit-price match (370¢) the ASCII C path would refuse — e.g.
`chicKen` → `$7.40` for 2 cases.

This tip moves the demo unit-cents haystack into
`services/domain/orderPresentationIdentity.ts` with ASCII C case fold and
ASCII-only end trim, so Kelvin lookalikes cannot invent demo draft totals while
operators review supplier order drafts.

## Scope

- Client domain helper `orderPresentationIdentity.ts`
  (`normalizeOrderPresentationItemToken`, `estimateOrderPresentationUnitCents`)
- Wire `utils/orderPresentation.ts` `estimateLineCents` through that helper
- Focused static + behavioral tests
- Does **not** re-tip Inventory categoryIcon (#701), settings deleteConfirmWord
  (#702), Inventory / Log Delivery typed-search (#698), Scan Item typed search
  (#697), or Ask Mise intent classify (#700)
- Does **not** rewrite SQL uniqueness / CHECK migrations
- Does **not** tip error-message haystacks in `inventoryEventTransport` /
  `recalculationPorts`, commit-hash lower in `betaReleaseReadiness`, or
  InventoryHealth / insights label lowercasing

## Verification

- `npm run typecheck`
- focused `tests/orderPresentationIdentityAsciiC.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Product note

Controlled pilot-ready codebase. This closes the demo supplier-draft price
Kelvin inventing gap deferred after #701/#702; it does not unblock live POS
credentials or App Store submission.
