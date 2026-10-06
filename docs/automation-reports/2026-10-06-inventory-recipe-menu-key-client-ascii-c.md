# MISE-005JI: pin inventory recipe menu-item identity to ASCII C

## Summary

`services/application/inventory.ts` matched recipe-baseline authorities and
existing ingredient mappings with Unicode-aware `trim` / `toLowerCase`. That
can invent Kelvin-sign (`K` → `k`) menu-item identity the hosted
`lower(... collate "C")` direction and sibling client tips refuse, and can
falsely attach authority or collapse distinct mappings.

This tip routes both match sites through an ASCII C case fold plus ASCII-only
whitespace collapse so recipe menu keys stay aligned with the COLLATE C
identity contract.

## Scope

- Client-only change in `services/application/inventory.ts`
- Focused static + behavioral tests
- Does **not** re-tip miseDomain menu keys (#675), operationalSignals (#677),
  setupDrafts (#676), inventoryUnits (#669), or providerSaleIdentity (#673)
- Does **not** rewrite SQL recipe / POS menu-name helpers

## Verification

- `npm run typecheck`
- focused `tests/inventoryRecipeMenuKeyClientAsciiC.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Product note

Controlled pilot-ready codebase. This closes a client recipe-baseline identity
parity gap; it does not unblock live POS credentials or App Store submission.
