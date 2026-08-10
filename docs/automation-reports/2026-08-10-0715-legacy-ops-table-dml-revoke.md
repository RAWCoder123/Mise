# Legacy ops table authenticated DML revoke

Date: 2026-08-10  
Branch: `cursor/mise-product-inspection-f2c9`  
Base tip: after restaurant provider-control SELECT-only (`e971a8d`)

## Gap

`sales_imports`, `supplier_items`, and `purchase_orders` still granted
authenticated INSERT/UPDATE/DELETE with manager write RLS policies after the
reinforce allowlist. Expo only SELECTs `supplier_items`; POS imports and
purchasing write through service/Edge paths. Residual PostgREST DML let a
manager forge import status, catalog rows, or legacy purchase orders.

## Fix

- Migration `20260810121000_revoke_legacy_ops_table_client_dml.sql` drops write
  policies and revokes authenticated DML; SELECT retained.
- `security-backend.mjs` expands `selectOnlyAuthenticatedTables` and pins final
  privileges/policies for these tables plus provider controls.
- Operational-mode pgTAP probes use `update_restaurant_profile` (restaurants
  UPDATE was already revoked).
- Tenant isolation privilege pins and unit coverage updated.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted staging remain environment-blocked.

## Classification impact

Still **controlled pilot-ready code** pending Docker + hosted security gate
re-run. Not App Store submission-ready.
