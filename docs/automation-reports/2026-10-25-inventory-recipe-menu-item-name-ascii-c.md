# MISE-005QC: pin inventory recipe-mapping menuItemName to ASCII C

Date: 2026-10-25  
Branch: `cursor/mise-inventory-recipe-menu-item-name-ascii-c`

## Inventing proof

`addRecipeBaselineIngredient` stored recipe-mapping menu item names via Unicode
`.trim()` before persisting them as durable `menu_item_name`:

```ts
const menuItemName = input.menuItemName.trim();
if (!menuItemName) throw new Error("Enter the POS menu item name.");
```

NBSP / em-space padding invented a clean durable menu item name before
persistence (`'\u2003Margherita Pizza\u2003'.trim() === 'Margherita Pizza'`).
Soft-empty Unicode-only padding also collapsed into the intentional empty gate.

Open tips that own related surfaces do not cover this operator boundary:

- #763 / MISE-005MG — inventory `menuItemId` (explicitly leaves `menuItemName`)
- #767 / MISE-005MK — inventory `inventoryItemId` (leaves `menuItemName` / `unit`)
- #678 / MISE-005JI — inventory recipe menu-item key client fold
- #862 / MISE-005QB — setup recipe `dishName` → `menu_item_name`
- #599 / MISE-005GI — `menu_item_ingredients.menu_item_name` SQL cntrl CHECK
- #861 / MISE-005QA — setup inventory / recipe units

## Change

- Add `services/domain/inventoryRecipeMenuItemNameIdentity.ts` with ASCII-only
  end trim and fail-closed canonicalize (MISE-005QC).
- Route `addRecipeBaselineIngredient` `menuItemName` through
  `requireCanonicalInventoryRecipeMenuItemName(...)`.
- Soft empty and Unicode-padded non-empty tokens fail closed with
  `Enter the POS menu item name.`
- Leave `inventoryItemId`, `unit`, restaurant workspace, and
  `menu_item_name.trim().toLowerCase()` comparison keys alone.

## Verification

- focused AsciiC: 4/4
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK relative to #763 / #767 / #678 / #862 / #599 / #861 (separate
modules). When landing with #763, drop #763's assertion that
`input.menuItemName.trim()` still Unicode-trims once this tip owns that field.
Keep `inventoryRecipeMenuItemNameIdentity` separate from
`inventoryMenuItemIdentity` / `inventoryItemIdentity` / setup dishName helpers.
