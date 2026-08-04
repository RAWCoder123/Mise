# Authenticated table DML privilege pin

Date: 2026-08-04  
Branch: `cursor/mise-product-inspection-c643`  
Base tip: `aae84ad` (`cursor/mise-product-inspection-0d95`)

## Gap

`scripts/security-backend.mjs` already pinned final authenticated **write policies** through `buildFinalAuthenticatedPolicies`, and unit tests asserted historical `REVOKE` migration strings. Final authenticated **table DML grants** were not simulated. A later migration could re-grant `INSERT`/`UPDATE`/`DELETE` (or column `UPDATE`) to `authenticated` on Edge-owned tables and still pass the private-beta backend gate while Docker/hosted privilege proofs were unavailable.

This is the same least-privilege class as the Aug 1 residual membership/profile DML revoke (`20260801211000_revoke_membership_and_profile_dml.sql`).

## Fix

- Add `scripts/sql-table-privileges.mjs` to replay migration `GRANT`/`REVOKE` table privilege DDL into a final authenticated privilege inventory.
- Handle schema-wide `REVOKE ALL ON ALL TABLES IN SCHEMA public`, multi-table grants, and column-level `UPDATE (...)`.
- Ignore function/schema/sequence/private-schema privilege statements (inventoried elsewhere).
- In `security-backend.mjs`, fail closed when:
  - restaurant-owned / membership / profile / tenant-root tables retain authenticated DML;
  - those tables lose authenticated `SELECT`;
  - service-only public tables retain any authenticated table privileges;
  - authenticated table privilege DDL cannot be parsed.
- Extend unit coverage in `tests/securityRemediation.test.ts` and security-backend contract asserts in `tests/security.test.ts`.

## Synthetic proof

Appending:

```sql
grant insert, update, delete on table public.restaurant_memberships to authenticated;
```

causes `npm run security:backend` to fail with:

`public.restaurant_memberships must not retain authenticated DML grants after service/Edge ownership (found INSERT, UPDATE, DELETE)`.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted staging remain environment-blocked in this run.

## Classification impact

Still **controlled pilot-ready code** pending Docker + hosted security gate re-run. Not App Store submission-ready.
