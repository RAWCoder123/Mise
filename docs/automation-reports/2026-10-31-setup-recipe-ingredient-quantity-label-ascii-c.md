# MISE-005UP: pin setup recipe ingredient quantity-per-sale assertBounded error labels to ASCII C

Date: 2026-10-31  
Branch: `cursor/mise-setup-recipe-ingredient-quantity-label-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

Application `validateSetupInput` embedded raw `ingredient.itemName` into
quantity-per-sale assertBounded Error labels
(`${ingredient.itemName || "Recipe ingredient"} quantity per sale`).

- Unicode-only space (`'\u2003'`) is truthy, so the intentional English
  `"Recipe ingredient"` fallback was bypassed and padding was embedded into
  the thrown Error (`'\u2003 quantity per sale'`).
- Em-space / NBSP-padded names invent a clean ingredient identity under
  Unicode `.trim()` (`'\u2003Roma Tomatoes\u2003'.trim() === 'Roma Tomatoes'`).
  Soft-null refuse keeps those padded tokens from inventing a clean label or
  from embedding padding into assertBounded Errors.

Open tip #979 / MISE-005UO explicitly left this recipe ingredient
assertBounded path alone while pinning inventory quantity/par labels.

## Change

- Add `services/domain/presentationSetupRecipeIngredientQuantityLabelIdentity.ts`
  with ASCII end trim; soft-null Unicode padding / controls / non-string.
- Route `services/application/setup.ts` recipe ingredient quantity-per-sale
  assertBounded error labels through
  `presentationSetupRecipeIngredientQuantityLabel`; preserve
  `|| "Recipe ingredient"` fallback.
- Leave inventory quantity/par assertBounded inventing (#979 / MISE-005UO),
  supplier-required inventing (#977), setup-screen ingredient validation
  labels (#976), setup-screen recipe validation labels (#975), durable recipe
  ingredient itemNames (#901 / #902), setup-drafts ingredient itemNames
  (#898), and recipe ingredient quantity drafts (#896) alone.

## Ownership

Owns application `validateSetupInput` recipe ingredient quantity-per-sale
assertBounded Error label presentation only. Does **not** own inventory
quantity/par assertBounded labels (#979), setup-screen ingredient validation
labels (#976), setup-screen recipe validation labels (#975), durable recipe
ingredient itemNames (#901 / #902), setup-drafts ingredient itemNames (#898),
or Recipes Settings quantity accessibility (#918).

## Merge note

Alone-OK. Keep module separate from #979 inventory quantity/par labels and
from #976 setup-screen ingredient validation labels. When landing with #979,
drop #979's assertion that recipe ingredient labels still use raw
`ingredient.itemName || "Recipe ingredient"`.

## Verification

- Focused AsciiC tests
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`
