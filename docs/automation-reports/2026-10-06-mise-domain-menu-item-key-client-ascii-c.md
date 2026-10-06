# MISE-005JF: pin miseDomain menu-item identity normalize to ASCII C

## Summary

`services/domain/miseDomain.ts` still normalized menu-item / sale demand keys
and learned-quantity unit suffixes with Unicode-aware `trim` / `toLowerCase` /
`\s+`. Sibling client tips already pin provider-sale identity (#673), inventory
units (#669), and purchase-line unit helpers (#668) to ASCII C, and hosted
helpers fold under SQL `lower(... collate "C")`. Under Unicode case folding, a
Kelvin sign (`K`) becomes `k`, which can invent a menu-item demand key or unit
learning bucket the ASCII C path would refuse.

This tip replaces `normalizeMenuItemKey` (and the `learnedQuantityKey` unit
fold that reuses it) with ASCII C case fold and ASCII-only whitespace collapse,
and routes the recipe-baseline manual sale key through the same helper.

## Scope

- Client-only change in `miseDomain.ts`
- Focused static + behavioral tests
- Does **not** re-tip providerSaleIdentity (#673), inventoryUnits (#669),
  purchase-line helpers (#668), barcode (#674), or setupDrafts header/keys
- Does **not** rewrite SQL menu-item uniqueness / POS identity CHECKs

## Verification

- `npm run typecheck`
- focused `tests/miseDomainMenuItemKeyClientAsciiC.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Product note

Controlled pilot-ready codebase. This closes a client identity parity gap for
demand/learning keys; it does not unblock live POS credentials or App Store
submission.
