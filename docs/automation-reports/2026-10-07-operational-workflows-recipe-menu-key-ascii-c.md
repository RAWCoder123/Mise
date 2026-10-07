# MISE-005JS: pin operational-workflows recipe menu-item identity to ASCII C

## Summary

`supabase/functions/operational-workflows` `upsert_recipe` matched existing
menu-item ingredient mappings with Unicode-aware `trim` / `toLowerCase`. That
can invent Kelvin-sign (`K` → `k`) menu-item identity the hosted
`lower(... collate "C")` direction and client tip MISE-005JI (#678) refuse, and
can falsely collapse distinct recipe mappings during edge recomputation.

This tip introduces `services/domain/recipeMenuItemKey.ts` with an ASCII C case
fold plus ASCII-only whitespace collapse, and routes the edge `upsert_recipe`
match through it.

## Scope

- Shared domain helper `services/domain/recipeMenuItemKey.ts`
- Edge change in `supabase/functions/operational-workflows/index.ts`
- Focused static + behavioral tests
- Does **not** re-tip client `services/application/inventory.ts` (#678 /
  MISE-005JI), miseDomain menu keys (#675), operationalSignals (#677),
  setupDrafts (#676), inventoryUnits (#669), inventoryBarcodeMatch (#687), or
  providerSaleIdentity (#673)
- Does **not** rewrite SQL recipe / POS menu-name helpers

## Verification

- `npm run typecheck`
- focused `tests/operationalWorkflowsRecipeMenuKeyAsciiC.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Product note

Controlled pilot-ready codebase. This closes an edge recipe-baseline identity
parity gap; it does not unblock live POS credentials or App Store submission.
