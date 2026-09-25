# Pin remaining authenticated SELECT-only tables against DML regression

Date: 2026-09-25  
Branch: `cursor/mise-select-only-ledger-privilege-pin`  
Base: `origin/main` @ `78da737`

## Gap

`security-backend` already proved residual authenticated DML is gone
(`withDml = []`), but `selectOnlyAuthenticatedTables` only pinned ~12 of 45
final SELECT-only tables. High-blast-radius ledgers such as
`inventory_events`, `activity_events`, `restaurant_tasks`, recipe/POS mapping
tables, and tenant roots could regain `GRANT INSERT/UPDATE/DELETE … TO
authenticated` without failing the private-beta gate when Docker pgTAP is
unavailable — the same regression class previously closed for
`inventory_items` / `purchase_lines`.

Open PR #399 only adds `suppliers` and `operational_finding_decisions` to the
pin set. It does not cover `inventory_events` or the remaining Edge-owned
tables, and it does not add a completeness check.

## Fix

- Expand `selectOnlyAuthenticatedTables` in `scripts/security-backend.mjs` to
  every final authenticated SELECT-only table (45), including
  `inventory_events` and the other residual Edge/RPC-owned ledgers.
- Add an inventory completeness check: any table that ends SELECT-only for
  `authenticated` but is missing from the pin set fails the gate.
- Contract tests in `tests/selectOnlyAuthenticatedTablesPin.test.ts` prove
  high-blast-radius membership, live inventory completeness, and that
  synthetic authenticated INSERT on `inventory_events` is treated as DML.
- `tests/security.test.ts` asserts the completeness failure string and
  `inventory_events` pin are present in the gate script.

No migration is required — grants are already SELECT-only; this hardens the
static gate so they stay that way.

## Verification

- `npm run typecheck`
- `npm test` (focused pin tests + full suite)
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`

Docker `supabase:test` and hosted staging remain environment-blocked.

## Classification impact

Still **controlled pilot-ready code**. This closes a private-beta security
gate completeness gap; it does not by itself move App Store submission
readiness.
