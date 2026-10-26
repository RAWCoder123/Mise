# MISE-005RG inventory detail settings quantity ASCII C (2026-10-26)

Tip: `cursor/mise-product-inspection-49d7` (inventory detail settings quantity).

## Inventing proof

`app/inventory/[id].tsx` fed `parLevel` / `reorderThreshold` into
`validateInventoryNumber` (`value.trim()` emptiness) and locale `parseNumber`
(`parseLocalizedNumber`), which Unicode-trims before parsing:

- `'\u200312\u2003'.trim() === '12'` invented a clean par level or reorder threshold
- `'\u2003'.trim() === ''` invented the field-required branch

Open #892 / MISE-005RF owns inventory detail operation `quantityText` and
intentionally left settings alone — do **not** retip #892 as covering #893; do
**not** tip #893 as a substitute for #892. Keep
`inventoryDetailSettingsQuantityIdentity.ts` separate from
`inventoryDetailQuantityIdentity.ts`. Open #891 / MISE-005RE owns Log Delivery
quantities; open #890 / MISE-005RD owns inventory count `draftCounts`; open
#889 / MISE-005RC owns Orders recommendation quantities; open #854 /
MISE-005PT owns inventory-operation notes — keep those modules separate.

## Change

- New `services/domain/inventoryDetailSettingsQuantityIdentity.ts` (MISE-005RG)
- Soft empty / Unicode-only space → `empty` (field-required path)
- ASCII whitespace still trims clean before locale `parseNumber`
- Unicode-padded / control → `invalid` (no invent; field-range error)
- Wire inventory detail settings save through
  `prepareInventoryDetailSettingsQuantityText`
- Left operation `quantityText`, notes, inventory count quantities, Orders
  recommendation quantities, and Log Delivery quantities alone

## Landing notes

Alone-OK with #892 / #891 / #890 / #889 / #854. Keep
`inventoryDetailSettingsQuantityIdentity.ts` separate from
`inventoryDetailQuantityIdentity.ts`, `logDeliveryQuantityIdentity.ts`,
`inventoryCountQuantityIdentity.ts`, `ordersRecommendationQuantityIdentity.ts`,
and `inventoryOperationNoteIdentity.ts`. When landing with #892, drop this tip's
assertion that inventory detail still uses bare `parseNumber(quantityText)` /
`validateOperationQuantity(quantityText, …)` once #892 owns that path; drop
#892's assertion that `validateInventoryNumber` / `value.trim()` remains once
this tip owns settings.

## Verification

focused AsciiC 4/4; typecheck; security static/backend; npm test (see tip PR).
