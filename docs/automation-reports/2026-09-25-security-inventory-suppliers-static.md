# Security inventory: suppliers + static gate sync (2026-09-25)

## Gap
`public.suppliers`, `public.operational_finding_decisions`, and
`public.purchase_decision_events` were created without `IF NOT EXISTS`. The
security gates only scanned `CREATE TABLE IF NOT EXISTS`, so those tables were
invisible to RLS/grant/ownership inventory checks. `suppliers` and finding
decisions were also missing from `restaurantOwnedTables` /
`selectOnlyAuthenticatedTables`, and `security-static.mjs` lagged the backend
owned-table set (including `purchase_lines` and count-session peers).

Hard-coded `2026-09-*` dates in `purchase_lines_rls.test.sql` would expire once
a 90-day purchase-line lookback lands (#398).

## Change
- Discover `CREATE TABLE` with optional `IF NOT EXISTS` in static + backend gates.
- Accept `ON TABLE` / `FROM public, anon, authenticated` revoke/grant spellings.
- Pin `suppliers` + `operational_finding_decisions` as restaurant-owned SELECT-only.
- Pin `purchase_decision_events` as service-only (no authenticated Data API access).
- Sync static `restaurantOwnedTables` to the backend set.
- Relativize purchase-line RLS fixture dates through `pg_temp.with_rel_purchase_dates`.
- Add pin tests for inventory alignment and fixture date wrapping.

## Verification
- `npm run typecheck`
- focused 12/12 (`supplierSecurityInventory`, `purchaseLineLedgerMigration`)
- `npm test` (688 passed / 0 fail)
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run supabase:test` blocked without Docker

## Notes
- No schema migration; gate/test-only hardening.
- Does not invent MOQ/lead_time/expiration.
- Distinct from open purchase-line date-bounds (#398) and inventory stacks (#301–#397).
