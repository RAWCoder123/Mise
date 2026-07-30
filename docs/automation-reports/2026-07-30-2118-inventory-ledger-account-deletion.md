# Automation report — 2026-07-30

## Completed

- Revoked authenticated INSERT/UPDATE/DELETE on `pos_integrations`, `sales_imports`, `supplier_items`, and `purchase_orders` (SELECT remains).
- Added append-only `inventory_movements` ledger; quantity changes in `service_update_inventory_and_signals` write before/after/actor/reason rows.
- Demo repository appends local movements; inventory detail shows count history.
- Added `account_deletion_requests`, `request_my_account_deletion` RPC, and `request-account-deletion` Edge Function (membership disable + Auth admin delete).
- Settings: privacy/support URL rows + DELETE confirmation account deletion flow.
- Removed duplicate Edge/docs stubs (`index 2.ts`, duplicate readiness doc).
- Updated pgTAP allowlists/privileges/probes and static security checks.
- Added `docs/app-store-readiness-checklist.md`.

## Verification run this pass

- `npm run typecheck` — pass
- `npm test` — 162/162 pass
- `npm run security:backend` — pass
- `npm run design:static` — pass
- Docker/`npm run supabase:test` — not available in this environment
- Hosted staging gate — credentials not present

## Current product state

- Local demo: still ready
- Controlled pilot / private beta with real tenants: blocked on Docker + hosted re-proof of the latest migration chain
- App Store submission: not ready (privacy/support URLs, Apple account, device QA still external)

## Next highest-priority work

1. Re-run full local pgTAP + hosted tenant gates after applying `20260730211800_...`.
2. Bounded CSV/demo POS ingest path so private beta is not dead-ended on fail-closed live POS.
3. Settings → Team membership UI over existing membership RPCs.
