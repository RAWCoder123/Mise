# MISE-005ABJ: pin POS mappings card-meta externalVariationId to ASCII C

Date: 2026-11-10
Branch: `cursor/mise-pos-mappings-external-variation-id-ascii-c`

## Surface

POS mappings review card meta variation line:

```tsx
{t("pos.mappings.variation", { value: mapping.externalVariationId })}
```

## Inventing proof

1. `requiredPosMappingString(row, "externalVariationId", 128)` accepts any string
   with `length >= 1`, so Unicode-only-space (`"\u2003"`) survives into the
   mapping queue and always-passes into blank-looking
   `"Square variation  "` chrome.
2. Unicode `.trim()` invents clean identity:
   `"\u2003VAR-A\u2003".trim() === "VAR-A"`.
3. Soft-null restores localized `pos.mappings.variation.none` while sibling
   `locationName`, `externalName`, suggested/selected menu-item names, and
   choice-list name/category stay raw on this tip.

## Fix

- `services/domain/presentationPosMappingsExternalVariationIdIdentity.ts` —
  ASCII C single-line normalize (end trim only; preserve NBSP; full C0/DEL
  reject)
- `app/settings/pos-mappings.tsx` — soft-null before
  `mappingExternalVariationId ? t("pos.mappings.variation", …) :
  t("pos.mappings.variation.none")`
- `i18n/catalog.ts` — EN/ES/zh-Hans `pos.mappings.variation.none`
- Focused inventing/bypass tests

## Ownership

Owns only POS mappings card-meta `mapping.externalVariationId` →
`pos.mappings.variation.none`. Leaves `mapping.locationName` (#1217),
`mapping.externalName` (#1216), suggested/selected menu-item names (#1024),
choice-list `menuItem.name` (#1207), and choice-list category (#1206) alone.

## Verification

- Focused `tests/posMappingsExternalVariationIdAsciiC.test.ts` 5/5 (78
  assertion call sites counted from source)
- `npm run typecheck` passed
- `npm test` — 688 total / 681 pass / 0 fail / 7 cancelled (inherited
  `withTimeout cancelledByParent`; fixed in #1183, not landed)
- No migration
