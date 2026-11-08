# MISE-005AAF: pin Inventory detail unit to ASCII C

Date: 2026-11-08

## Summary

Soft-null empty/Unicode-padded inventory item units before composing Inventory
detail quantity suffixes and unit-bearing labels so blank identity falls
through to `inventory.detail.unit.none` instead of inventing a clean unit
label or rendering blank-looking unit copy.

## Inventing proof

- Free-form `inventory_items.unit`
- `"\u2003cs\u2003".trim() === "cs"` invents a clean unit via Unicode trim
- `"\u2003"` / `""` remain non-nullish/always-pass and render blank-looking
  quantity suffixes (`"12.0  "`) and label shells (`"Par level ()"`)

## Scope

- `services/domain/presentationInventoryDetailUnitIdentity.ts`
- `app/inventory/[id].tsx` display paths only
- `i18n/catalog.ts` EN/ES/ZH `inventory.detail.unit.none`
- `tests/inventoryDetailUnitAsciiC.test.ts`

## Left alone

- Inventory detail subtitle category (#1189)
- Inventory detail supplier_name (#1052)
- Inventory detail title item.item_name (#1017)
- setup inventory units (#861)
- inventory recipe-mapping units (#864)
- inventoryUnits client helpers (#669)
- Inventory hub / Scan Item / RecommendationDecisionRow unit surfaces
- controlled `inventory.ops.unit.${canonicalUnit}` labels
- No migration

## Verification

- `npm run typecheck`
- focused `tests/inventoryDetailUnitAsciiC.test.ts`
- `npm test`
