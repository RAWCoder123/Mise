# MISE-005UK setup recipe validation label ASCII C

Date: 2026-10-30

## Problem

Setup recipe validation used Unicode `.trim()` on `recipe.dishName` before
embedding it in recipeName / recipeIngredient / ingredientFields /
ingredientRange messages
(`recipe.dishName.trim() || t("setup.validation.recipeLabel", …)`).
`'\u2003Margherita Pizza\u2003'.trim()` invented `'Margherita Pizza'`. Soft
empty / Unicode-only space collapsed into the intentional i18n recipeLabel
fallback. Open #974 / MISE-005UJ explicitly left recipe / ingredient
validation labels alone.

## Change

- Add `services/domain/presentationSetupRecipeValidationLabelIdentity.ts`
- Wire recipe validation labels in `app/(auth)/setup.tsx`
- Focused inventing proofs in
  `tests/presentationSetupRecipeValidationLabelAsciiC.test.ts`
- Leave ingredient validation labels, inventory validation labels (#974),
  setup supplier ChoiceChip labels (#973), and sibling presentation tips alone

## Ownership

Owns setup recipe validation labels only. Does **not** own setup ingredient
validation labels, setup inventory validation labels (#974), setup supplier
ChoiceChip labels (#973), durable supplierNames (#904), setup-screen supplier
identity (#696), setup supplier name/email (#680), inventory item names
(#903), Create Task assignee (#963), Login email chip (#971), or supplier
draft line labels (#972).
