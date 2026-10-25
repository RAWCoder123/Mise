# MISE-005QD: pin inventory recipe-mapping unit to ASCII C

Date: 2026-10-25  
Branch: `cursor/mise-inventory-recipe-unit-ascii-c`

## Inventing proof

`addRecipeBaselineIngredient` stored recipe-mapping units via Unicode `.trim()`
before compatibility checks and durable mapping writes:

```ts
const unit = input.unit.trim();
if (!unit) throw new Error("Inventory unit is required.");
```

NBSP / em-space padding invented a clean durable unit before persistence
(`'\u2003lb\u2003'.trim() === 'lb'`). Soft-empty Unicode-only padding also
collapsed into the intentional empty gate.

Open tips that own related surfaces do not cover this operator boundary:

- #861 / MISE-005QA — setup inventory draft / recipe ingredient units
- #669 / MISE-005JA — inventoryUnits client fold
- #709 / MISE-005KN — operationalMapping unit tip
- #767 / MISE-005MK — inventory `inventoryItemId` (leaves `unit`)
- #863 / MISE-005QC — inventory recipe-mapping `menuItemName` (leaves `unit`)
- #586 / MISE-005FV — inventory_items.unit SQL cntrl CHECK

## Change

- Add `services/domain/inventoryRecipeUnitIdentity.ts` with ASCII-only end trim
  and fail-closed canonicalize (MISE-005QD).
- Route `addRecipeBaselineIngredient` `unit` through
  `requireCanonicalInventoryRecipeUnit(...)`.
- Soft empty and Unicode-padded non-empty tokens fail closed with
  `Inventory unit is required.`
- Leave `menuItemName`, `inventoryItemId`, restaurant workspace, and
  `menu_item_name.trim().toLowerCase()` comparison keys alone.

## Verification

- focused AsciiC: 4/4
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK relative to #861 / #863 / #767 / #669 / #709 / #586 (separate
modules). When landing with #863, drop #863's assertion that
`input.unit.trim()` still Unicode-trims once this tip owns that field. Keep
`inventoryRecipeUnitIdentity` separate from `setupInventoryUnitIdentity` /
`inventoryUnits` / menuItemName helpers.
