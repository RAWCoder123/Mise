# MISE-005RE Log Delivery quantity ASCII C

Date: 2026-10-26

## Gap

`app/more/log-delivery.tsx` fed `quantityText` into locale `parseNumber`
(`parseLocalizedNumber`), which Unicode-trims before parsing:

- `'\u200312\u2003'.trim() === '12'` invented a clean receipt quantity
- `'\u2003'.trim() === ''` invented the empty / quantity-error branch

## Change

- New `services/domain/logDeliveryQuantityIdentity.ts` (MISE-005RE)
- Soft empty / Unicode-only space → `empty` (same quantity-error validation)
- ASCII whitespace still trims clean before `parseNumber`
- Unicode-padded / control → `invalid` (quantity-error validation)
- Wire Log Delivery submit through `prepareLogDeliveryQuantityText`
- Left Log Delivery notes (`noteText.trim()`) alone for open #886 / MISE-005QZ
- Left inventory count `draftCounts`, Orders recommendation quantities, and
  inventory detail operation quantities alone

## Verification

- focused AsciiC tests
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend` when available
- `npm test`
