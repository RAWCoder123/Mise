# Drop orphan operational write RLS policies

Date: 2026-08-01
Branch: `cursor/mise-product-inspection-b97d`
Base tip: `b096d18` (`cursor/mise-product-inspection-a823`)

## Problem

Authenticated DML grants on `inventory_items`, `menu_item_ingredients`, `pos_sales`, and `setup_attachments` were revoked when mutations moved to service/Edge ledger workflows, but the original manager write RLS policies remained. Grants already block Data API writes today; leaving the policies would reopen ledger-bypassing direct writes if privileges ever regress.

`scripts/security-backend.mjs` previously validated create-policy text without computing final create/drop state, so orphan write policies could not fail the static gate.

Restaurant data export also selected `restaurant_member_invites` with `select("*")`, loading `token_hash` into the Edge process before redaction.

## Fix

1. Migration `20260801230000_drop_orphan_operational_write_policies.sql` drops the 12 residual INSERT/UPDATE/DELETE policies and documents SELECT-only ownership.
2. pgTAP probes assert those four tables retain no authenticated write policies.
3. `security-backend.mjs` builds final authenticated policy state and fails if restaurant-owned / membership / profile tables keep write policies.
4. `export-restaurant-data` selects invite roster columns without `token_hash` (redaction retained as defense in depth).

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`

Docker pgTAP execution and hosted staging re-proof remain environment-blocked in this workspace.

## Classification impact

Still **controlled pilot-ready code** pending Docker + hosted security gate re-run. Not App Store submission-ready.
