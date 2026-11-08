# MISE-005AAG: pin Inventory hub unit to ASCII C

Date: 2026-11-08

## Summary

Soft-null empty/Unicode-padded inventory item units before composing the
Inventory hub OperationalRow quantity subtitle so blank identity falls through
to `inventory.row.unit.none` instead of inventing a clean unit label or
rendering blank-looking unit copy.

## Inventing proof

- Free-form `inventory_items.unit`
- `"\u2003cs\u2003".trim() === "cs"` invents a clean unit via Unicode trim
- `"\u2003"` / `""` remain non-nullish/always-pass and render blank-looking
  quantity subtitles (`"12.0   · 3 days"`)

## Scope

- `services/domain/presentationInventoryHubUnitIdentity.ts`
- `app/(tabs)/inventory.tsx` InventoryListRow subtitle path only
- `i18n/catalog.ts` EN/ES/ZH `inventory.row.unit.none`
- `tests/inventoryHubUnitAsciiC.test.ts`

## Left alone

- Inventory detail display unit (#1191)
- Inventory hub item.item_name (#1056)
- Inventory detail subtitle category (#1189)
- Inventory detail supplier_name (#1052)
- Inventory detail title item.item_name (#1017)
- setup inventory units (#861)
- inventory recipe-mapping units (#864)
- inventoryUnits client helpers (#669)
- Scan Item / RecommendationDecisionRow unit surfaces
- controlled `inventory.ops.unit.${canonicalUnit}` labels
- No migration

## Verification

- `npm run typecheck`
- focused `tests/inventoryHubUnitAsciiC.test.ts` — 5/5 pass
- assertion call sites counted from source: **58**
- `npm test` — 688 total / 681 pass / 0 fail / 7 cancelled (inherited
  withTimeout cancelledByParent; fixed in #1183, not landed)
