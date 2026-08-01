# Edge-route supplier recipient upsert (2026-08-01)

## Problem

Managers could still upsert supplier email recipients through the authenticated Data API RPC `upsert_supplier_recipient`, bypassing `operational-workflows` Edge reservation, rate limiting, and Edge audit logging.

## Change

- Migration `20260801020000_edge_upsert_supplier_recipient.sql`:
  - Adds service-owned `service_upsert_supplier_recipient` (`service_role` only).
  - Revokes authenticated execute on the legacy public upsert RPC.
  - Keeps catalog allowlisting, normalization, and manager+ role checks.
  - Leaves domain audit to Edge (`supplier_recipient_upserted`) so clients cannot bypass reservation/logging.
- Edge `operational-workflows` adds manager+ `upsert_supplier_recipient`.
- Hosted repository uses Edge; local demo path unchanged.
- pgTAP supplier recipient suite asserts privilege revokes and service-RPC authority.
- Static security/unit contracts cover Edge action, service grants, and hosted repository routing.

## Verification

- `npm run typecheck`, `npm test`, `npm run security:backend`, `npm run design:static`, `npm run qa:routes` in this cycle when the environment allows.
- Docker/hosted `verify:private-beta-security` remains blocked here without Docker/staging credentials.
