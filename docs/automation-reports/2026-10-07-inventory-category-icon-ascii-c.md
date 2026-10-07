# MISE-005KF: pin Inventory categoryIcon identity to ASCII C

## Summary

`app/(tabs)/inventory.tsx` still classified category icons with Unicode-aware
`trim` / `toLowerCase`. Sibling tip #698 pins Inventory typed-search to ASCII C
and explicitly deferred this display heuristic. Under Unicode case folding, a
Kelvin sign (`K`) becomes `k`, which invents `chicken` / `milk` (and sibling)
category icon matches the ASCII C path would refuse — e.g. `chicKen` → Beef
icon, `milK` → Milk icon.

This tip moves category → icon kind classification into
`services/domain/inventoryCategoryIconIdentity.ts` with ASCII C case fold and
ASCII-only end trim, so Kelvin lookalikes and non-C mid-string whitespace cannot
invent icon identity while browsing the Inventory tab.

## Scope

- Client domain helper `inventoryCategoryIconIdentity.ts`
  (`normalizeInventoryCategoryIconToken`, `classifyInventoryCategoryIcon`)
- Wire `app/(tabs)/inventory.tsx` `categoryIcon` through that helper
- Focused static + behavioral tests
- Does **not** re-tip Inventory / Log Delivery typed-search (#698), Scan Item
  typed search (#697), inventory barcode match (#687), or Ask Mise intent
  classify (#700)
- Does **not** rewrite SQL uniqueness / CHECK migrations
- Does **not** tip other free-form/display-only lowercasing paths (insights
  labels, demo price heuristics, settings deleteConfirmWord compare)

## Verification

- `npm run typecheck`
- focused `tests/inventoryCategoryIconIdentityAsciiC.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Product note

Controlled pilot-ready codebase. This closes the Inventory categoryIcon Kelvin
inventing gap deferred by #698; it does not unblock live POS credentials or App
Store submission.
