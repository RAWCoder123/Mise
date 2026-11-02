# Recipe-baseline inventory itemName ASCII-C tip (2026-11-02)

## Milestone

MISE-005WA

## Defect

`buildRecipeBaselineSummary` selected ingredient display labels with:

```ts
itemNames.get(mapping.inventory_item_id) ?? "Inventory item"
```

Unicode-only-space inventory `item_name` values are non-nullish under `??`, so
Settings Recipes ingredient rows and `linkedInventoryItems` bypassed the
intentional hard-coded `"Inventory item"` empty state. Empty string has the
same bypass. Unicode `.trim()` on padded inventory names would invent a clean
label before those rows / a11y strings are rendered.

## Fix

- Add `services/domain/presentationRecipeBaselineInventoryItemNameIdentity.ts`
- Soft-null via `normalizeRecipeBaselineInventoryItemName` before both
  `"Inventory item"` rows in `buildRecipeBaselineSummary`
- ASCII end trim only; preserve NBSP; full C0/DEL reject

## Alone-OK

Does **not** own Inventory detail title item_name (#1017), waste itemName
(#1018), demo recipe-baseline ingredient-entry (#906), setup-drafts ingredient
itemName (#898), activityEvents `itemName ?? "Inventory"`, or setup validation
`item.name || "Inventory item"` error labels.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
