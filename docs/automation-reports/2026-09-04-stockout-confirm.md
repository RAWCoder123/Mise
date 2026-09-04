# Stockout confirmation before zeroing on-hand (2026-09-04)

## Problem

Inventory detail Stockout → Submit queued a zero-quantity ledger event immediately.
Projection sets on-hand to zero. A StatusNotice warned operators, but there was no
confirmation step, so a mis-tap could permanently zero authoritative stock.

## Fix

- Stockout submit shows a destructive `Alert.alert` with item name and current on-hand.
- Cancel closes the alert without queuing.
- Confirm runs the existing outbox queue + flush path.
- EN / ES / zh-Hans copy for title, body, and confirm action.

## Out of scope

- Structured stockout reason codes (#366)
- Retiring operator counts (#388)
- On-hand floor/ceiling preflights (#383 / #387)

## Verification

- `npm run typecheck`
- `tests/stockoutConfirmUi.test.ts`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
