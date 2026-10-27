# MISE-005RI setup inventory on-hand quantity ASCII C

Date: 2026-10-27  
Branch: `cursor/mise-setup-inventory-quantity-ascii-c`

## Problem

`app/(auth)/setup.tsx` fed inventory on-hand `quantity` into
`item.quantity.trim()` emptiness / range gates and locale `parseNumber` via
`isBoundedSetupNumber` / `normalizeDraftNumber`. Locale parsing Unicode-trims
before parsing, so NBSP / em-space padding invented a clean on-hand quantity
(`'\u200312\u2003'.trim() === '12'`). Unicode-only space also invented the
required-empty branch via `'\u2003'.trim() === ''`.

## Change

- New `services/domain/setupInventoryQuantityIdentity.ts` (MISE-005RI)
- Soft empty / Unicode-only space → `empty` (required quantity; blank normalize)
- ASCII whitespace still trims clean before locale `parseNumber`
- Unicode-padded / control → `invalid` (`onHandRange`; no invent)
- Wire setup inventory validate + normalize through `prepareSetupInventoryQuantityText`
- Leave setup inventory `parLevel` to open #894 / MISE-005RH
- Leave recipe ingredient quantities alone
- Leave inventory detail settings quantities to open #893 / MISE-005RG
- Leave inventory detail operation `quantityText` to open #892 / MISE-005RF
- Leave inventory count `draftCounts` (#890), Orders recommendation quantities
  (#889), and Log Delivery quantities (#891) alone

## Landing notes

Alone-OK with #894 / #893 / #892 / #891 / #890 / #889. Keep
`setupInventoryQuantityIdentity.ts` separate from
`setupInventoryParLevelIdentity.ts`,
`inventoryDetailSettingsQuantityIdentity.ts`,
`inventoryDetailQuantityIdentity.ts`, `logDeliveryQuantityIdentity.ts`,
`inventoryCountQuantityIdentity.ts`, and
`ordersRecommendationQuantityIdentity.ts`. When landing with #894, drop this
tip's assertion that setup still uses `item.parLevel.trim()` /
`normalizeDraftNumber(item.parLevel, …)` once #894 owns setup parLevel; drop
#894's assertion that setup still uses bare
`isBoundedSetupNumber(item.quantity, …)` /
`normalizeDraftNumber(item.quantity, …)` once this tip owns setup on-hand
quantity.

## Verification

- focused AsciiC 4/4
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles` on main; tip +4 vs main ~683)
