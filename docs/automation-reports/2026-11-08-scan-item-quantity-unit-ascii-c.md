# MISE-005AAH: pin Scan Item quantity unit to ASCII C

Date: 2026-11-08

## Summary

Soft-null empty/Unicode-padded inventory item units before composing the Scan
Item OperationalRow quantity value so blank identity falls through to
`scanItem.row.unit.none` instead of inventing a clean unit label or rendering
blank-looking unit copy.

## Inventing proof

- Free-form `inventory_items.unit`
- `"\u2003cs\u2003".trim() === "cs"` invents a clean unit via Unicode trim
- `"\u2003"` / `""` remain non-nullish/always-pass and render blank-looking
  quantity values (`"12.0  "`)

## Scope

- `services/domain/presentationScanItemQuantityUnitIdentity.ts`
- `app/more/scan-item.tsx` OperationalRow quantity `value` path only
- `i18n/catalog.ts` EN/ES/ZH `scanItem.row.unit.none`
- `tests/scanItemQuantityUnitAsciiC.test.ts`

## Left alone

- Scan Item row meta category (#1190)
- Scan Item row item.item_name (#1061)
- Inventory hub quantity unit (#1192)
- Inventory detail display unit (#1191)
- setup inventory units (#861)
- inventory recipe-mapping units (#864)
- inventoryUnits client helpers (#669)
- RecommendationDecisionRow suggested unit
- controlled `inventory.ops.unit.${canonicalUnit}` labels
- No migration

## Verification

- `npm run typecheck`
- focused `tests/scanItemQuantityUnitAsciiC.test.ts` — 5/5 pass
- assertion call sites counted from source: **63**
- `npm test`
