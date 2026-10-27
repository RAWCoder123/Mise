# MISE-005RH setup inventory parLevel ASCII C (2026-10-27)

Tip: `cursor/mise-setup-inventory-par-level-ascii-c` (PR pending).

## Inventing proof

`app/(auth)/setup.tsx` fed inventory `parLevel` into `item.parLevel.trim()`
optional emptiness / range gates and locale `parseNumber` via
`isBoundedSetupNumber` / `normalizeDraftNumber`, which Unicode-trim before
parsing:

- `'\u200312\u2003'.trim() === '12'` invented a clean setup par level
- `'\u2003'.trim() === ''` invented the optional-empty branch

Open #893 / MISE-005RG owns inventory detail settings `parLevel` /
`reorderThreshold` and intentionally left setup alone — do **not** retip #893
as covering #894; do **not** tip #894 as a substitute for #893. Keep
`setupInventoryParLevelIdentity.ts` separate from
`inventoryDetailSettingsQuantityIdentity.ts`. Open #892 / MISE-005RF owns
inventory detail operation quantity; open #891 / MISE-005RE owns Log Delivery
quantities; open #890 / MISE-005RD owns inventory count `draftCounts`; open
#889 / MISE-005RC owns Orders recommendation quantities — keep those modules
separate. Setup inventory on-hand `quantity` and recipe ingredient quantities
remain on bare `normalizeDraftNumber` / `isBoundedSetupNumber` for a future tip.

## Change

- New `services/domain/setupInventoryParLevelIdentity.ts` (MISE-005RH)
- Soft empty / Unicode-only space → `empty` (optional par; blank normalize)
- ASCII whitespace still trims clean before locale `parseNumber`
- Unicode-padded / control → `invalid` (no invent; `parRange` validation)
- Wire setup inventory validate + normalize through
  `prepareSetupInventoryParLevelText`
- Left setup on-hand quantity, recipe quantities, inventory detail settings /
  operation quantities, inventory count quantities, Orders recommendation
  quantities, and Log Delivery quantities alone

## Landing notes

Alone-OK with #893 / #892 / #891 / #890 / #889. Keep
`setupInventoryParLevelIdentity.ts` separate from
`inventoryDetailSettingsQuantityIdentity.ts`,
`inventoryDetailQuantityIdentity.ts`, `logDeliveryQuantityIdentity.ts`,
`inventoryCountQuantityIdentity.ts`, and
`ordersRecommendationQuantityIdentity.ts`. When landing with #893, drop this
tip's assertion that inventory detail still uses bare
`parseNumber(parLevel)` / `parseNumber(reorderThreshold)` once #893 owns that
path; drop #893's assertion that setup still uses
`item.parLevel.trim()` / `normalizeDraftNumber(item.parLevel, …)` once this tip
owns setup parLevel.

## Verification

focused AsciiC 4/4; typecheck; security static/backend; npm test (see tip PR).
