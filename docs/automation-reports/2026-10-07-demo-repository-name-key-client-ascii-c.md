# MISE-005JN: pin demoRepository inventory/menu identity normalize to ASCII C

## Summary

`services/repositories/demoRepository.ts` still normalized inventory item names
and menu item names with Unicode-aware `trim` / `toLowerCase` for setup upsert
dedupe, recipe mapping match, inventory upsert, and synthetic `demo-menu:`
authority ids. Sibling client tips already pin setup inventory names (#679),
recipe menu keys (#678), and miseDomain demand keys (#675) to ASCII C, and
hosted helpers fold under SQL `lower(... collate "C")`. Under Unicode case
folding, a Kelvin sign (`K`) becomes `k`, which can invent a demo identity key
the ASCII C path would refuse.

This tip replaces those identity folds with ASCII C case fold and ASCII-only
whitespace trim (matching prior `trim().toLowerCase()` semantics without
collapsing interior spaces).

## Scope

- Client/demo repository change in `demoRepository.ts`
- Focused static + behavioral tests
- Does **not** re-tip setup.ts (#679), inventory.ts (#678), miseDomain (#675),
  providerSaleIdentity (#673), or supplierSendContent (#425)
- Does **not** rewrite SQL uniqueness / CHECK migrations

## Verification

- `npm run typecheck`
- focused `tests/demoRepositoryNameKeyClientAsciiC.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Product note

Controlled pilot-ready codebase. This closes a demo identity parity gap for
inventory/menu name keys; it does not unblock live POS credentials or App Store
submission.
