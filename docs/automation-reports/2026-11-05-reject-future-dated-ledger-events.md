# Reject future-dated inventory ledger events (2026-11-05)

## Problem

Counts already failed closed when `effective_at` was more than two minutes ahead
of the server clock. Receipt, waste, usage, adjustment, transfer, stockout, and
correction rows could still project into on-hand from a fast device clock (or a
direct RPC), silently distorting inventory and purchase recommendations.

An earlier tip (#367) used migration timestamp `20260903120000`, which collides
with the merged MISE-004C purchase-line ledger migration on `main`. This tip is
the post-004C refresh with a non-colliding timestamp.

## Change

- Domain: reject future-dated non-count events with `future_dated_event`
  (counts keep `future_dated_count`)
- Migration: `20261105220000_reject_future_dated_inventory_events.sql`
- pgTAP + unit/migration pin tests
- Historical `reject_future_dated_inventory_count` function body broadened as an
  alias so residual references stay fail-closed

## Out of scope

- Inventory policy tips #1116–#1120
- Zero-quantity tip #1119 (compose lightly on land)
- Transport-reason mapping #1103
- Receive expiration dating
- Contested Home / operatingBrief fail-closed stacks

## Verification

- `npm run typecheck` — passed
- Focused `tests/inventoryLedger.test.ts` + `tests/authoritativeInventoryCount.test.ts` — 47/47
- `npm test` — 678 pass / 0 fail / 7 cancelled (inherited withTimeout flakiness)
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- pgTAP source updated at `supabase/tests/database/inventory_event_ledger.test.sql`
  (plan 29 from assertion call sites; Docker not available in this environment)
