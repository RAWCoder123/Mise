# MISE-005ABF: pin POS mappings card-header locationName to ASCII C

Date: 2026-11-09
Branch: `cursor/mise-pos-mappings-location-name-ascii-c`

## Surface

POS mappings review card location row name:

```tsx
<Text style={styles.location}>{mapping.locationName}</Text>
```

## Inventing proof

1. `requiredPosMappingString(row, "locationName", 160)` accepts any string with
   `length >= 1`, so Unicode-only-space (`"\u2003"`) survives into the mapping
   queue and always-passes into blank-looking card-header location chrome.
2. Unicode `.trim()` invents clean identity:
   `"\u2003Main Counter\u2003".trim() === "Main Counter"`.
3. Soft-null restores localized `common.none` while sibling `externalName`,
   suggested/selected menu-item names, and choice-list name/category stay raw
   on this tip.

## Fix

- `services/domain/presentationPosMappingsLocationNameIdentity.ts` — ASCII C
  single-line normalize (end trim only; preserve NBSP; full C0/DEL reject)
- `app/settings/pos-mappings.tsx` — soft-null before
  `mappingLocationName || t("common.none")`
- Focused inventing/bypass tests

## Ownership

Owns only POS mappings card-header `mapping.locationName` → `common.none`.
Leaves `mapping.externalName` (#1216 / MISE-005ABE), suggested/selected
menu-item names (#1024), choice-list `menuItem.name` (#1207), choice-list
category (#1206), and Square ingest `external_name` (#947) alone.

## Verification

- Focused `tests/posMappingsLocationNameAsciiC.test.ts` 5/5 (79 assertion call
  sites counted from source)
- `npm run typecheck`
- `npm test`
- No migration
