# MISE-005RD inventory count quantity ASCII C (2026-10-26)

Tip: `cursor/mise-inventory-count-quantity-ascii-c`.

## Inventing proof

`app/inventory/count.tsx` `buildCountLinePayload()` Unicode-trimmed
`draftCounts[line.inventory_item_id]` before emptiness and ECMAScript `Number`:

- `'\u200312\u2003'.trim() === '12'` invented a clean counted quantity
- `Number('\u200312\u2003') === 12` invents even without an explicit `.trim()`
- `'\u2003'.trim() === ''` invented the empty / skip-line branch

Live variance display used the same Unicode trim / `Number` path on
`countedRaw`.

Open #885 / MISE-005QY owns inventory count-sheet **notes** and intentionally
left `draftCounts` alone — do **not** retip #885 as covering this tip; do
**not** tip this as a substitute for #885. Open #889 / MISE-005RC owns Orders
recommendation quantities — keep
`inventoryCountQuantityIdentity.ts` separate from
`ordersRecommendationQuantityIdentity.ts`. Log Delivery `quantityText` remains
out of scope for a later tip.

## Change

- New `services/domain/inventoryCountQuantityIdentity.ts` (MISE-005RD)
- Soft empty / Unicode-only space → `empty` (skip line)
- ASCII whitespace still trims clean before `Number`
- Unicode-padded / control / non-finite → `invalid` (skip line; no invent)
- Wire count-sheet save/submit and variance display through
  `prepareInventoryCountQuantityText`
- Left count-sheet notes (`noteRaw.trim()`), Log Delivery quantity, and Orders
  recommendation quantities alone

## Landing notes

When landing with open #885, drop #885's assertion that
`draftCounts[...].trim()` remains, and drop this tip's assertions that
`noteRaw.trim()` remains / `normalizeInventoryCountSheetNote` is absent once
#885 owns notes. When landing with open #889, drop this tip's assertion that
Orders still Unicode-trims `quantities[recommendation.id]` once #889 owns that
path.

## Verification

- focused AsciiC tests
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test` (expect pre-existing `recalculationCycles` hung `withTimeout`
  cancellations on this environment even on clean `origin/main`)
