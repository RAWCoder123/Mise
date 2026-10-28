# MISE-005SW recipe-authority hydrate menuItemName ASCII C (2026-10-28)

## Summary

Stop Unicode `.trim()` on hosted recipe-authority hydrate `menuItemName` from
inventing clean durable POS dish names via em-space / NBSP padding
(`'\u2003Margherita Pizza\u2003'.trim() === 'Margherita Pizza'`).

- Add `services/repositories/recipeAuthorityMenuItemNameIdentity.ts`
  (ASCII C single-line identity: ASCII end trim; fail closed when Unicode
  padding remains; C0/DEL rejected)
- Route `parseRecipeAuthorityState` `menuItemName` through
  `normalizeRecipeAuthorityMenuItemName`
- Soft empty / Unicode-padded / control-bearing tokens soft to `""` so the
  existing `Recipe authority returned an invalid response.` gate fails closed
- Leave `menuItemId` hydrate untrimmed; leave application write tip #863 /
  MISE-005QC and demo baseline tip #905 alone

## Inventing proof

On `origin/main`, `parseRecipeAuthorityState` did:

```ts
const menuItemName =
  typeof payload.menuItemName === "string" ? payload.menuItemName.trim() : "";
```

Em-space / NBSP padding invented a clean `RecipeAuthorityState.menuItemName`
before recipe-authority list / confirm responses reached the client.

## Alone-OK notes

- Do **not** share `inventoryRecipeMenuItemNameIdentity` (#863 / MISE-005QC)
- Do **not** tip application `addRecipeBaselineIngredient` write path here
- Do **not** tip demo `menu_item_name.trim().toLowerCase()` match folds here
- Leave account-deletion / export / Gmail / Square error haystacks alone
  (#931–#933 / #930 / #929)
