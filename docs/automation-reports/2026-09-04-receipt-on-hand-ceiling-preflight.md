# Receipt on-hand ceiling preflight (2026-09-04)

## Summary
Operators can queue receipts that would push projected on-hand above the
hosted 1e6 native ceiling. Demo previously threw on that projection failure,
so the device outbox deferred the bad event forever as a network retry.
Hosted RPC used one 22023 message for both floor and ceiling, so receipt
overflow was indistinguishable from insufficient stock.

## Changes
- `services/domain/inventoryOnHandGuard.ts` mirrors hosted conversion math for
  decreasing (floor) and increasing (ceiling) moves, plus event-type-aware
  rejection reason helpers.
- Inventory detail Receive and Log Delivery preflight receipts against remaining
  ceiling capacity with EN/ES/zh-Hans copy.
- Demo `recordInventoryEvent` returns terminal `insufficient_on_hand` /
  `exceeds_on_hand_ceiling` instead of throwing.
- Hosted transport passes `eventType` so receipt overflow maps to
  `exceeds_on_hand_ceiling` and waste/usage map to `insufficient_on_hand`.

## Verification
- `npm run typecheck`
- focused domain + transport + UI pins
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`

## Notes
- Does not invent MOQ/lead_time/expiration.
- Distinct from waste UI floor preflight (#383); decrease helper is included for
  shared reuse when usage/adjustment stacks land.
- No migration: hosted SQL still uses one message; client distinguishes by
  attempted event type.
