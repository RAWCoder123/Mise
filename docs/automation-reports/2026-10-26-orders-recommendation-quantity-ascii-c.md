# MISE-005RC Orders recommendation quantity ASCII C

Date: 2026-10-26

## Gap

`app/(tabs)/orders.tsx` `approve()` Unicode-trimmed
`quantities[recommendation.id]` before locale `parseNumber`:

- `'\u200312\u2003'.trim() === '12'` invented a clean purchase quantity
- `'\u2003'.trim() === ''` invented the empty / quantity-range branch

## Change

- New `services/domain/ordersRecommendationQuantityIdentity.ts` (MISE-005RC)
- Soft empty / Unicode-only space → `empty` (same quantity-range validation)
- ASCII whitespace still trims clean before `parseNumber`
- Unicode-padded / control → `invalid` (quantity-range validation)
- Wire Orders review approve through `prepareOrdersRecommendationQuantityText`
- Left inventory count `draftCounts` and Log Delivery `quantityText` alone

## Verification

- focused AsciiC tests
- `tests/ordersUi.test.ts` contract update
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend` when available
- `npm test`
