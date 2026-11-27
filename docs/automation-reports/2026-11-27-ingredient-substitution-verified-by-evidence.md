# Ingredient substitution verified_by INSERT evidence

Date: 2026-11-27  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-ingredient-substitution-verifier-evidence-main`

## Gap

`public.ingredient_substitutions.verified_by` is nullable so account deletion
can anonymize only the verifier while preserving the substitution's
operational history. Writers normally INSERT draft rows and later UPDATE into
`verification_status = 'verified'` with a stamped actor (open manager-authority
CRUD #1099), but any insert path that reaches the table can still mint a
verified claim with `verified_by = null` — an unattributable verification that
Activity / audit analysis cannot pin to an operator.

## Change

- Domain: `validateIngredientSubstitutionVerifiedByEvidence` rejects
  `missing_verified_by` when status is already `verified` and the verifier id
  is null, undefined, or blank.
- Additive BEFORE INSERT trigger
  `private.enforce_ingredient_substitution_verified_by_evidence` with the same
  rule.
- Intentionally **no** NOT NULL / status-implies-actor CHECK — a CHECK would
  block the auth ON DELETE SET NULL anonymization UPDATE escape.
- Does not rewrite any verify writer (none on main yet; #1099 verifies via
  UPDATE).
- pgTAP plan=9 from assertion call sites: null verified-insert reject,
  attributed verified insert accept, draft insert accept, verification UPDATE
  accept + verified_by stamp, account-deletion anonymization still clears only
  `verified_by`.

## Alone-OK

Orthogonal to supplier-delivery verified_by (#1297), recipe confirmation actor
(#1307), restaurant-memory decision evidence (#1299/#1308), and inventory /
purchase-line actor tips. Does not rewrite the open #1099 verify RPC. Does not
modify shared foundation fixtures. Compatible with #1099 because verification
is an UPDATE after draft INSERT.

## Verification

- `npm run typecheck`
- focused verified-by suite
- `npm test`
- `npm run security:static` / `security:backend` / `design:static`
- `npm run supabase:test` — not run in this environment when Docker is unavailable
