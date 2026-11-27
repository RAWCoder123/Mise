# Ingredient substitution verified_at INSERT evidence

Date: 2026-11-27  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-ingredient-substitution-verified-at-evidence-main`

## Gap

`public.ingredient_substitutions.verified_at` is nullable so draft / rejected /
expired inserts legitimately leave it null until a later verification UPDATE
stamps the timestamp. Account deletion clears only `verified_by`
(`ON DELETE SET NULL`) and preserves `verified_at`. Writers normally INSERT
draft rows and later UPDATE into `verification_status = 'verified'` with a
stamped timestamp (open manager-authority CRUD #1099), but any insert path that
reaches the table can still mint a verified claim with `verified_at = null` —
a verification that Activity / audit analysis cannot place in time.

## Change

- Domain: `validateIngredientSubstitutionVerifiedAtEvidence` rejects
  `missing_verified_at` when status is already `verified` and the timestamp is
  null, undefined, or blank.
- Additive BEFORE INSERT trigger
  `private.enforce_ingredient_substitution_verified_at_evidence` with the same
  rule.
- Intentionally **no** NOT NULL / status-implies-timestamp CHECK — tip stays
  INSERT-only and orthogonal to the companion verified_by actor tip (#1309).
- Does not rewrite any verify writer (none on main yet; #1099 verifies via
  UPDATE).
- pgTAP plan=9 from assertion call sites: null verified-insert reject,
  time-stamped verified insert accept (also stamps `verified_by` for contested
  merge with #1309), draft insert accept, verification UPDATE accept +
  verified_at stamp, account-deletion anonymization clears only `verified_by`
  while preserving `verified_at`.

## Alone-OK

Companion to ingredient-substitution verified_by (#1309). Orthogonal to
recipe-version verified_at (#1311), restaurant-memory decision time (#1308),
and recipe confirmation actor (#1307). Does not rewrite the open #1099 verify
RPC. Does not modify shared foundation fixtures. Compatible with #1099 because
verification is an UPDATE after draft INSERT.

## Verification

- `npm run typecheck`
- focused verified-at suite
- `npm test`
- `npm run security:static` / `security:backend` / `design:static`
- `npm run supabase:test` — not run in this environment when Docker is unavailable
