# MISE-005RF inventory detail quantity ASCII C (2026-10-26)

Tip: `cursor/mise-inventory-detail-quantity-ascii-c`.

## Inventing proof

`app/inventory/[id].tsx` fed `quantityText` into `validateOperationQuantity`
(`value.trim()` emptiness) and locale `parseNumber` (`parseLocalizedNumber`),
which Unicode-trims before parsing:

- `'\u200312\u2003'.trim() === '12'` invented a clean operation quantity
- `'\u2003'.trim() === ''` invented the field-required branch

Open #854 / MISE-005PT owns inventory-operation **notes** and intentionally
left `quantityText` alone — do **not** retip #854 as covering #892; do **not**
tip #892 as a substitute for #854. Open #891 / MISE-005RE owns Log Delivery
quantities — keep `inventoryDetailQuantityIdentity.ts` separate from
`logDeliveryQuantityIdentity.ts`. Open #890 / MISE-005RD owns inventory count
`draftCounts` — keep separate from `inventoryCountQuantityIdentity.ts`. Open
#889 / MISE-005RC owns Orders recommendation quantities — keep separate.
Inventory detail settings (`parLevel` / `reorderThreshold`) remain out of
scope for a later tip.

## Change

- New `services/domain/inventoryDetailQuantityIdentity.ts` (MISE-005RF)
- Soft empty / Unicode-only space → `empty` (field-required path)
- ASCII whitespace still trims clean before locale `parseNumber`
- Unicode-padded / control → `invalid` (no invent)
- Wire inventory detail operation submit through `prepareInventoryDetailQuantityText`
- Left notes (`noteText.trim()`), settings fields, inventory count quantities,
  Orders recommendation quantities, and Log Delivery quantities alone

## Landing notes

Alone-OK with #854 / #891 / #890 / #889. When landing with #854, drop this tip's
assertion that `noteText.trim()` remains once #854 owns notes. When landing
with #891, drop this tip's assertion that Log Delivery still uses bare
`parseNumber(quantityText)` once #891 owns that path. When landing with
#889/#890, drop those tips' assertions that inventory detail still uses bare
`parseNumber(quantityText)` once this tip owns that path.
