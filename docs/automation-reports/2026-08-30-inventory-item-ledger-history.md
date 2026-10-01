# Per-item inventory ledger history (2026-08-30)

Branch: `cursor/mise-product-inspection-1b60`
Base: `origin/main` @ `20b28e5`

## Problem

Inventory detail showed outlook, operator actions, and outbox queue evidence,
but not the append-only ledger movements that actually moved on-hand stock.
`listInventoryEvents` also lacked an item filter, so a detail screen would have
had to over-fetch restaurant-wide rows.

## Change

1. `listInventoryEvents` accepts optional `inventoryItemId` (hosted + demo).
2. `fetchInventoryItemLedgerHistory` returns a bounded newest-first window
   (`ITEM_LEDGER_HISTORY_LIMIT = 40`) with truncation reporting.
3. Inventory detail loads item history with outlook/queue and renders a
   Movement history card (signed deltas, count set-to, stockout clear,
   before-count-boundary badge).
4. EN/ES/zh-Hans keys for all ledger event types and history copy.

## Verification

- `npm run typecheck`: passed
- focused: `tests/inventoryItemLedgerHistory.test.ts` + `tests/repositoryContracts.test.ts`: 13/13
- `npm test`: 644 / 637 pass / 0 fail / 7 cancelled
- `npm run security:static`: passed
- `npm run security:backend`: passed

## Do not redo

- Restaurant-wide waste hub recent events
- Count-session authority / return-for-revision (#283)
- Draft order line undo (#284)
