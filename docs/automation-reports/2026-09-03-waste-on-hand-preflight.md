# Waste on-hand preflight (2026-09-03)

## Problem
Hosted and demo inventory projection already reject waste/usage that would drive
on-hand below zero, but operators only saw opaque RPC failures. In demo mode the
repository threw, so the device outbox deferred the event as a network retry.

## Change
- Domain `checkDecreasingInventoryFitsOnHand` mirrors the hosted conversion math.
- Inventory detail waste submit preflights against current on-hand and shows
  available quantity in EN/ES/zh-Hans.
- Hosted RPC `22023` on-hand messages map to terminal `insufficient_on_hand`.
- Demo `recordInventoryEvent` returns rejected instead of throwing for negative
  projection so the outbox settles instead of retrying forever.
- Flush result copy surfaces insufficient on-hand when queue evidence says so.

## Verification
- `npm run typecheck`
- focused unit/UI pins + `npm test`
- `npm run security:static` / `npm run security:backend` / `npm run design:static` when available

## Out of scope
- Usage screen (#365) — reuse the same domain helper when that stack lands.
- Inventing MOQ / lead time / expiration fields.
- Contested soft-load / operatingBrief stacks.
