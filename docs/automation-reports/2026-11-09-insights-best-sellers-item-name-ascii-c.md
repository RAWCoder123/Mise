# MISE-005AAK: Insights analytics best-sellers itemName ASCII C

## Summary

Soft-null empty / Unicode-padded / control-bearing Insights analytics
best-sellers `item.itemName` values before seller-name chrome. Closes the
prior always-pass path where Unicode-only-space names rendered blank-looking
item identity, and refuses Unicode `.trim()` inventing of clean display
names. Soft-null restores the localized
`insights.analytics.bestSellers.itemName.none` fallback (EN/ES/ZH).

## Scope

- Helper: `services/domain/presentationInsightsBestSellersItemNameIdentity.ts`
- Call site: `app/(tabs)/insights.tsx` best-sellers seller-name chrome
- Catalog: `insights.analytics.bestSellers.itemName.none` in EN/ES/ZH
- Focused tests: `tests/insightsBestSellersItemNameAsciiC.test.ts`
- Leaves Daily Report sales top-sellers (#1063), waste/deliveries itemName
  tips (#1064 / #1065), Ask Mise top-sale names (#937), InsightListRow title
  (#1185), signal presentation tips (#1166–#1168), and React list keys alone
- No migration

## Inventing proof

Free-form best-seller `item.itemName` always rendered into seller-name
chrome. Unicode-padded / Unicode-only-space invent blank-looking item
identity via trim / always-pass `{item.itemName}`; soft-null → localized
none fallback.

## Verification

- `npx tsx --test tests/insightsBestSellersItemNameAsciiC.test.ts` — 5/5
  (51 assertion call sites counted from source)
- `npm run typecheck`
- `npm test`
