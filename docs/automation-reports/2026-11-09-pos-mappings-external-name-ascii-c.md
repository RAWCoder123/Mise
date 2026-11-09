# MISE-005ABE: pin POS mappings card-header externalName to ASCII C

Date: 2026-11-09
Branch: `cursor/mise-pos-mappings-external-name-ascii-c`

## Surface

POS mappings review card primary external catalog name:

```tsx
<Text style={styles.mappingName}>{mapping.externalName}</Text>
```

## Inventing proof

1. `requiredPosMappingString(row, "externalName", 240)` accepts any string with
   `length >= 1`, so Unicode-only-space (`"\u2003"`) survives into the mapping
   queue and always-passes into blank-looking card-header primary chrome.
2. Unicode `.trim()` invents clean identity:
   `"\u2003Square Burger\u2003".trim() === "Square Burger"`.
3. Soft-null restores localized `common.none` while sibling `locationName`,
   suggested/selected menu-item names, and choice-list name/category stay raw
   on this tip.

## Fix

- `services/domain/presentationPosMappingsExternalNameIdentity.ts` — ASCII C
  single-line normalize (end trim only; preserve NBSP; full C0/DEL reject)
- `app/settings/pos-mappings.tsx` — soft-null before
  `mappingExternalName || t("common.none")`
- Focused inventing/bypass tests

## Ownership

Owns only POS mappings card-header `mapping.externalName` → `common.none`.
Leaves `mapping.locationName`, suggested/selected menu-item names (#1024),
choice-list `menuItem.name` (#1207), choice-list category (#1206), and Square
ingest `external_name` (#947) alone.

## Verification

- Focused `tests/posMappingsExternalNameAsciiC.test.ts` 5/5 (77 assertion call sites counted from source)
- `npm run typecheck` passed
- `npm test` — 688 total / 681 pass / 0 fail / 7 cancelled (inherited `withTimeout cancelledByParent`; fixed in #1183, not landed)
- No migration
