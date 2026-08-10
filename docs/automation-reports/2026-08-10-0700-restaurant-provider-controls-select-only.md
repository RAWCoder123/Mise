# Restaurant provider controls SELECT-only

Date: 2026-08-10  
Branch: `cursor/mise-product-inspection-f2c9`  
Base tip: `54dc88f` (`integration/mise-current`)

## Gap

`public.restaurant_operational_controls` granted authenticated `UPDATE` with an
owner/admin RLS policy. That let a restaurant owner Data-API enable
`gmail_delivery_enabled`, `square_sync_enabled`, and related flags—half of the
provider claim gate—without service-role / founder approval. Global
`system_operational_controls` was already SELECT-only.

## Fix

- Migration `20260810120000_revoke_restaurant_operational_controls_client_dml.sql`
  drops the owner/admin UPDATE policy and revokes authenticated DML.
- `scripts/sql-table-privileges.mjs` inventories final authenticated table grants.
- `scripts/security-backend.mjs` pins both provider-control tables as SELECT-only
  (privileges + final write-policy inventory).
- pgTAP: tenant isolation + operational mode privilege probes; mode mutation
  probes moved to `restaurants` profile updates.
- Unit coverage in `tests/providerKillSwitches.test.ts`.
- Docs: `docs/security-readiness.md`, `docs/square-backend.md`.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted staging remain environment-blocked in this run.

## Classification impact

Still **controlled pilot-ready code** pending Docker + hosted security gate
re-run. Not App Store submission-ready.
