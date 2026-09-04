# Inventory event transport rejection reasons (2026-09-04)

## Problem

Hosted `record_inventory_event` rejects several `22023` validation failures with
operator-actionable Postgres messages, but the client transport collapsed them to
opaque `invalid_inventory_event`. Demo mode also **threw** on unverified canonical
conversion, so the device outbox deferred forever as `network_retry`.

Affected messages on current main / open stacks:

- `Inventory item canonical conversion is not verified`
- `Physical count evidence cannot be effective in the future` (main)
- `Inventory ledger events cannot be effective in the future` (open #367)

The existing `"canonical unit"` substring match correctly maps unit enum failures
and does **not** match `"canonical conversion"`, so conversion failures previously
fell through to the opaque default.

## Fix

- Map conversion and future-dated RPC messages in
  `inventoryEventRejectionFromRpcError` to stable reason codes:
  `canonical_conversion_unverified`, `future_dated_count`, `future_dated_event`
- Demo `recordInventoryEvent` returns a terminal rejection for unverified
  conversion instead of throwing
- Inventory detail queue evidence localizes known reason codes (EN/ES/zh-Hans)
- Flush status distinguishes conversion and future-dated rejections

## Out of scope

- On-hand insufficiency mapping / waste preflight (open #383)
- Broadening domain/DB future-dated rejection to non-count events (open #367)
- Inventing MOQ / lead_time / expiration

## Verification

- `npm run typecheck`
- `npm test` (focused transport + UI pins; full suite)
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
