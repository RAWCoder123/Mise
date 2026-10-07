# MISE-005KC: pin Inventory and Log Delivery typed-search identity to ASCII C

## Summary

`app/(tabs)/inventory.tsx` and `app/more/log-delivery.tsx` still normalized
typed inventory search with Unicode-aware `trim` / `toLowerCase`. Sibling tip
#697 pins Scan Item typed search to ASCII C, and hosted helpers fold under SQL
`lower(... collate "C")`. Under Unicode case folding, a Kelvin sign (`K`)
becomes `k`, which can invent a typed-search hit the ASCII C path would refuse.

This tip moves Inventory tab and Log Delivery typed-search matching into
`services/domain/inventoryTypedSearchIdentity.ts` with ASCII C case fold and
ASCII-only end trim, so Kelvin lookalikes and non-C whitespace cannot invent
substring identity while browsing or filtering inventory on those screens.

## Scope

- Client domain helper `inventoryTypedSearchIdentity.ts`
  (`normalizeInventoryTypedSearchToken`,
  `inventoryOutlookMatchesTypedSearchQuery`,
  `logDeliveryItemMatchesTypedSearchQuery`)
- Wire `app/(tabs)/inventory.tsx` and `app/more/log-delivery.tsx` through those
  helpers
- Focused static + behavioral tests
- Does **not** re-tip Scan Item typed search (#697), inventory barcode match
  (#687), setup-screen supplier identity (#696), or display-only
  `categoryIcon` lowercasing on the Inventory tab
- Does **not** rewrite SQL uniqueness / CHECK migrations
- Does **not** tip free-form/display-only lowercasing paths (`askMise`,
  insights labels, demo price heuristics)

## Verification

- `npm run typecheck`
- focused `tests/inventoryTypedSearchIdentityAsciiC.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Product note

Controlled pilot-ready codebase. This closes Inventory and Log Delivery
typed-search identity parity gaps beside the Scan Item tip; it does not unblock
live POS credentials or App Store submission.
