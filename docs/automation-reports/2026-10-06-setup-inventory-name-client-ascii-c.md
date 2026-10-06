# MISE-005JJ: pin setup inventory-name identity normalize to ASCII C

## Summary

`services/application/setup.ts` still keyed draft inventory rows and recipe
ingredient links with Unicode-aware `trim` / `toLowerCase`. Sibling client tips
already pin recipe menu-item keys (#678), setupDrafts headers (#676), and
miseDomain demand keys (#675) to ASCII C, and hosted helpers fold under SQL
`lower(... collate "C")`. Under Unicode case folding, a Kelvin sign (`K`)
becomes `k`, which can invent a setup inventory-name match when linking a
recipe ingredient to a draft inventory item the ASCII C path would refuse.

This tip replaces the inventory-name map key with ASCII C case fold and
ASCII-only trim, and routes recipe-ingredient lookup through the same helper.
Linked recipe mappings now persist the matched inventory draft name rather than
the ingredient spelling that only matched after a locale-sensitive fold.

## Scope

- Client-only change in `services/application/setup.ts`
- Focused static + behavioral tests
- Does **not** re-tip setupDrafts (#676), inventory recipe menu keys (#678),
  miseDomain (#675), team email (#674), or supplier-name SQL (#410)
- Does **not** tip setup supplier-name dedupe (`toLocaleLowerCase("en-US")`) or
  `normalizeOptionalEmail` in this change

## Verification

- `npm run typecheck`
- focused `tests/setupInventoryNameClientAsciiC.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Product note

Controlled pilot-ready codebase. This closes a client identity parity gap for
setup inventory ↔ recipe linking; it does not unblock live POS credentials or
App Store submission.
