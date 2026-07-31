# Edge-route storage location create and external supplier place (2026-07-31)

## Problem

`create_storage_location` and `confirm_supplier_order_placed` were callable as authenticated Data API RPCs from the Expo client. That bypassed `operational-workflows` Edge reservation, rate limiting, and Edge audit logging even though peer mutations (transfer, receive, waste, counts) already required the Edge path.

## Change

- Migration `20260731220000_edge_storage_location_and_external_place.sql`:
  - Adds `private`/`public.service_create_storage_location` (manager+, service_role only).
  - Adds `private`/`public.service_confirm_supplier_order_placed` (manager+, service_role only).
  - Revokes authenticated execute on legacy `public.create_storage_location` and `public.confirm_supplier_order_placed`.
- Edge `operational-workflows` adds manager-only actions `create_storage_location` and `confirm_supplier_order_placed` with audit actions `storage_location_created` and `supplier_order_placed_externally`.
- Hosted repository methods now invoke those Edge actions instead of direct RPCs. Local demo paths unchanged.

## Verification

- Static security contracts updated for Edge action + service RPC + revoke patterns.
- `npm run typecheck`, `npm test`, `npm run security:backend`, `npm run design:static` in this cycle.
- Docker/hosted `verify:private-beta-security` still blocked in this environment (no Docker / no staging credentials).
