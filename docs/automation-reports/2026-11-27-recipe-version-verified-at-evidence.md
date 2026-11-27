# Recipe-version verified_at INSERT evidence (2026-11-27)

## Gap

`recipe_versions.verified_at` is nullable so draft / retired inserts
legitimately leave it null until a later verification UPDATE stamps the
timestamp. Account-deletion anonymization clears only `verified_by`
(`ON DELETE SET NULL`) and preserves `verified_at`. Direct inserts can still
mint `status = 'verified'` with `verified_at = null` — a verification that
Activity / audit analysis cannot place in time.

## Change

- Domain: `validateRecipeVersionVerifiedAtEvidence` → `missing_verified_at`
- Additive BEFORE INSERT tip only on `public.recipe_versions`
- No NOT NULL / status-implies-timestamp CHECK (stays INSERT-only; orthogonal
  to companion verified_by actor tip #1310)
- Does not rewrite any verify writer
- pgTAP plan = 9 (derived from assertion call sites)

## Alone-OK

Companion to #1310 (`verified_by` only). Successful verified fixtures stamp
both `verified_at` and `verified_by` so contested merge with #1310 stays
green. Orthogonal to ingredient-substitution verified_by (#1309),
restaurant-memory decision time (#1308), and recipe confirmation actor
(#1307). Draft inserts without `verified_at` remain allowed. Account-deletion
anonymization clears `verified_by` while preserving `verified_at`.

## Verification

- `npm run typecheck`
- focused `recipeVersionVerifiedAtEvidence` suite
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- Docker `npm run supabase:test` when available
