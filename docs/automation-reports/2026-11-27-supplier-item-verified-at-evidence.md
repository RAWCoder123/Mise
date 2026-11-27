# Supplier item verified_at INSERT evidence

Date: 2026-11-27  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-supplier-item-verified-at-evidence-main`

## Gap

`public.supplier_items.verified_at` is nullable so draft / rejected /
expired inserts legitimately leave it null until a later verification UPDATE
stamps the timestamp. Account deletion clears only `verified_by`
(`ON DELETE SET NULL`) and preserves `verified_at`. Client DML is revoked, but
any insert path that reaches the table (service_role / direct SQL) can still
mint a verified claim with `verified_at = null` — a verification that Activity /
audit analysis cannot place in time.

## Change

- Domain: `validateSupplierItemVerifiedAtEvidence` rejects
  `missing_verified_at` when status is already `verified` and the timestamp is
  null, undefined, or blank.
- Additive BEFORE INSERT trigger
  `private.enforce_supplier_item_verified_at_evidence` with the same rule.
- Intentionally **no** NOT NULL / status-implies-timestamp CHECK — tip stays
  INSERT-only and orthogonal to the companion verified_by actor tip (#1313).
- Does not rewrite any verify writer.
- pgTAP plan=9 from assertion call sites: null verified-insert reject,
  time-stamped verified insert accept (also stamps `verified_by` for contested
  merge with #1313), draft insert accept, verification UPDATE accept +
  verified_at stamp, account-deletion anonymization clears only `verified_by`
  while preserving `verified_at`.

## Alone-OK

Companion to supplier-item verified_by (#1313). Orthogonal to ingredient-
substitution verified_at (#1312), recipe-version verified_at (#1311), and the
open purchase-line / inventory tip stacks (#1238/#1250–#1258/#1263–#1310).
Does not modify shared foundation fixtures (tenant_isolation inserts remain
draft by default).

## Verification

- `npm run typecheck`
- focused verified-at suite
- `npm test`
- `npm run security:static` / `security:backend` / `design:static`
- `npm run supabase:test` — not run in this environment when Docker is unavailable
