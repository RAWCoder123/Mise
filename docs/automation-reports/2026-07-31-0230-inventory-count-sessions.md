# Inventory count sessions (2026-07-31)

## Completed

- Brought prior private-beta hardening onto `cursor/mise-product-inspection-9df5` (secondary DML close, ledger, CSV POS consumption, waste, team directory, account deletion, Expo doctor alignment).
- Implemented multi-item inventory count sessions:
  - Tables `inventory_count_sessions` / `inventory_count_lines` with one open session per restaurant.
  - Service-owned Edge actions: begin, save lines, submit, cancel, approve.
  - Approve applies counted quantities, writes `manual_count` ledger rows, and refreshes recommendations/insights under planning revision lock.
  - Demo repository parity and schema_version 5 migration for local stores.
  - Inventory list entry point plus `/inventory/count` operator UI (EN/ES/zh-Hans).
  - Today task when a session is in progress or submitted.

## Verification in this workspace

- Unit/domain coverage for progress, variance planning, merge rules, and workflow guards.
- Static security contract coverage for Edge actions, RPC grants, and client write path.
- Typecheck and `npm test` (run after implementation).
- Docker/hosted RLS re-proof still required for the new migration.
