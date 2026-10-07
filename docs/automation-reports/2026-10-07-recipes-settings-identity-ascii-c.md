# MISE-005JT: pin recipes-settings inventory/menu identity to ASCII C

## Summary

`app/settings/recipes.tsx` matched typed inventory names and missing-menu
suggestion chips with Unicode-aware `trim` / `toLowerCase`. That can invent
Kelvin-sign (`K` → `k`) inventory or menu identity the hosted
`lower(... collate "C")` direction and sibling client tips refuse, and can
falsely highlight or attach a recipe baseline link the ASCII C path would not.

This tip introduces `services/domain/recipeSettingsIdentity.ts` with an ASCII C
case fold plus ASCII-only trim, and routes the recipes-settings inventory
selection, menu-chip active state, and persisted menu-name trim through it.

## Scope

- Shared domain helper `services/domain/recipeSettingsIdentity.ts`
- UI change in `app/settings/recipes.tsx`
- Focused static + behavioral tests
- Does **not** re-tip client `services/application/inventory.ts` (#678 /
  MISE-005JI), operational-workflows edge (#688 / MISE-005JS), setup inventory
  names (#679), miseDomain menu keys (#675), inventoryBarcodeMatch (#687), or
  replaceableDemo setup/lookup (#686)
- Does **not** rewrite SQL recipe / POS menu-name helpers

## Verification

- `npm run typecheck`
- focused `tests/recipesSettingsIdentityAsciiC.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Product note

Controlled pilot-ready codebase. This closes a recipes-settings identity
parity gap; it does not unblock live POS credentials or App Store submission.
