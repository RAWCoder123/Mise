# Order-message Notes strip locale (2026-08-30)

## Scope

Make the order-detail "generated body" preview strip trailing operator notes for
all supplier-send Notes headers (`Notes:` / `Notas:` / `备注：`), not English
only. Complements #269 (locale templates) without overlapping that stack.

## Changes

- `utils/orderPresentation.ts` — `stripOperatorNoteFromOrderMessage` +
  `SUPPLIER_ORDER_NOTES_HEADERS`
- `app/orders/[id].tsx` — `generatedOrderMessage` uses the shared helper
- `tests/orderMessageNotesStrip.test.ts`

## Non-goals

- Supplier-send body/subject template localization (#269)
- Structured `delivery_date` wiring (#266)
- Rewriting stored `order_message` rows

## Verification

- `npm run typecheck`
- `npm test` (orderMessageNotesStrip + suite)
- `npm run security:static`
