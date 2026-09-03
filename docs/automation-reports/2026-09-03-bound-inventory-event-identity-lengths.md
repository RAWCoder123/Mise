# Bound inventory event identity lengths (2026-09-03)

## Problem

`inventory_events` already CHECKs trimmed `source` (80), `client_event_id` (200),
and `idempotency_key` (240). Domain `acceptInventoryEvent` and the offline outbox
still treated those identity fields as unbounded, so demo/offline paths could
accept oversized payloads. On hosted inserts the bare CHECK surfaces as
SQLSTATE `23514`, which `inventoryEventRejectionFromRpcError` does not map to a
terminal rejection — oversized identity would retry forever. Truncating would
forge a different idempotency key, so rejection is required.

## Fix

- Domain `validateEventInput` rejects `source_too_long`, `client_event_id_too_long`,
  and `idempotency_key_too_long` using shared `securityLimits` constants.
- Transport maps the matching `22023` messages to the same terminal reasons.
- Additive migration `20260903180000_bound_inventory_event_identity_lengths.sql`
  installs a BEFORE INSERT trigger with clear `22023` messages on every write
  path without re-declaring `record_inventory_event`.
- Dedicated pgTAP `inventory_event_identity_lengths.test.sql` proves boundary
  accept and oversized reject for each field.

## Verification

- `npm run typecheck`
- focused: `inventoryLedger`, `inventoryEventTransport`, `inventoryEventIdentityLengthsMigration`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run supabase:test` (Docker may be unavailable locally)

## Deploy note

Deploy the additive migration before relying on clear terminal messages hosted.
Existing column CHECKs already hard-capped storage; this tip closes domain/demo
parity and outbox retry loops.
