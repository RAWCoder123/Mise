# Receipt ledger correction (2026-09-02)

## Summary

Managers can reverse mistaken **Log Delivery** (`operator_receipt`) ledger rows
via More → Correct a receipt. The path appends an append-only `correction` that
supersedes the receipt once and subtracts the exact receipt quantity from
on-hand. Supplier-order receives (`supplier_delivery`) remain out of scope.

## Why

Mistaken manual receipts permanently inflated on-hand on `origin/main`. Open
#345 covers waste only; #348 adds unsigned-to-signed adjustments without linking
to a specific receipt. This slice closes the Log Delivery integrity gap without
touching contested receive / Log Delivery screens.

## Changes

- Domain: `services/domain/receiptCorrection.ts`
- Application: `services/application/receiptCorrection.ts` (+ miseService export)
- Validation: `requireReceiptCorrectionInput` (generic ops still force
  `supersedesEventId: null`)
- UI: `app/more/receipt-correct.tsx`, More hub row, stack route, EN/ES/zh-Hans
- Smoke: `/more/receipt-correct` in route + layout smoke lists
- Tests: `tests/receiptCorrection.test.ts`, `tests/receiptCorrectionUi.test.ts`,
  hub/tenant safety pins

## Verification

- `npm run typecheck`
- `npm test` (focused receipt correction + hub/tenant pins; full suite)
- `npm run security:static`
- `npm run design:static`

## Non-goals

- No schema migration (uses existing `record_inventory_event` correction)
- Does not edit `app/more/log-delivery.tsx` or order receive paths
- Does not invent MOQ / lead_time / expiration
- Does not consume substitutions / yields / modifiers
