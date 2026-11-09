# MISE-005AAV: POS mappings choice-list menuItem.name ASCII C

## Summary

Soft-null empty / Unicode-padded / control-bearing POS mappings choice-list
`menuItem.name` values before radio primary chrome. Closes the prior
always-pass path where Unicode-only-space names rendered blank-looking
menu-item identity, and refuses Unicode `.trim()` inventing of clean display
names. Soft-null restores the localized `common.none` fallback (EN/ES/ZH).

## Scope

- Helper: `services/domain/presentationPosMappingsChoiceListMenuItemNameIdentity.ts`
- Call site: `app/settings/pos-mappings.tsx` expanded choice-list radio primary
- Catalog: existing `common.none` (no new keys)
- Focused tests: `tests/posMappingsChoiceListMenuItemNameAsciiC.test.ts`
- Leaves POS mappings suggested/selected menu-item names (#1024 / MISE-005VP),
  choice-list category meta (#1206 / MISE-005AAU), Inventory detail item_name
  (#1017), Insights best-sellers itemName (#1196), and Home low-stock itemName
  (#1178) alone
- No migration

## Inventing proof

Free-form choice-list `menuItem.name` always rendered into radio primary
chrome. Unicode-padded / Unicode-only-space invent blank-looking menu-item
identity via trim / always-pass `{menuItem.name}`; soft-null → `common.none`.

## Verification

- `npx tsx --test tests/posMappingsChoiceListMenuItemNameAsciiC.test.ts` — 5/5
  (66 assertion call sites counted from source)
- `npm run typecheck` — passed
- `npm test` — 688 total / 681 pass / 0 fail / 7 cancelled (inherited
  `withTimeout` cancelledByParent; fixed in #1183, not landed)
