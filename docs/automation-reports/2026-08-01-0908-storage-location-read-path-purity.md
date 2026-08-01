# Storage location read-path purity (2026-08-01)

## Problem

`fetchStorageLocations` called `ensure_restaurant_storage_locations`, which
inserted or reactivated the Main storage location during ordinary inventory
reads. Demo listing also seeded Main through `mutateDemoState`.

## Change

- Migration `20260801090819_storage_location_read_path_purity.sql`:
  - Adds read-only `list_restaurant_storage_locations` for authenticated members.
  - Revokes authenticated execute on `ensure_restaurant_storage_locations`.
  - Seeds Main during `service_create_restaurant_with_owner` (write path).
- Hosted repository lists via the new RPC; demo list no longer seeds Main.
- Existing transfer/create/balance write paths still call
  `private.ensure_main_storage_location` / `ensureDemoMainStorageLocation`.

## Verification

- Unit/security/design/route checks in this cycle when the environment allows.
- Docker/hosted re-proof still required for the full migration chain.
