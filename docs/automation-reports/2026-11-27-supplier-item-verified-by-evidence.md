# Supplier item verified_by INSERT evidence

Date: 2026-11-27  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-supplier-item-verified-by-evidence-main`

## Gap

`public.supplier_items.verified_by` is nullable so draft / rejected /
expired inserts legitimately leave it null until a later verification UPDATE
stamps the actor. Account deletion clears only `verified_by`
(`ON DELETE SET NULL`) and preserves `verified_at` / verification status.
Client DML is revoked, but any insert path that reaches the table
(service_role / direct SQL) can still mint a verified claim with
`verified_by = null` — a verification that Activity / audit analysis cannot
pin to an operator.

## Change

- Domain: `validateSupplierItemVerifiedByEvidence` rejects
  `missing_verified_by` when status is already `verified` and the actor is
  null, undefined, or blank.
- Additive BEFORE INSERT trigger
  `private.enforce_supplier_item_verified_by_evidence` with the same rule.
- Intentionally **no** NOT NULL / status-implies-actor CHECK — tip stays
  INSERT-only and preserves account-deletion anonymization.
- Does not rewrite any verify writer.
- pgTAP plan=9 from assertion call sites: null verified-insert reject,
  attributed verified insert accept (also stamps `verified_at` for a future
  companion tip), draft insert accept, verification UPDATE accept +
  verified_by stamp, account-deletion anonymization clears only `verified_by`
  while preserving verification status and business fields.

## Alone-OK

Orthogonal to ingredient-substitution verified_by (#1309), recipe-version
verified_by (#1310), supplier-delivery verified_by (#1297), and the open
purchase-line / inventory tip stacks (#1238/#1250–#1258/#1263–#1312). Does
not modify shared foundation fixtures (tenant_isolation inserts remain draft
by default). Companion `verified_at` tip remains separate.

## Verification

- `npm run typecheck`
- focused verified-by suite
- `npm test`
- `npm run security:static` / `security:backend` / `design:static`
- `npm run supabase:test` — not run in this environment when Docker is unavailable
