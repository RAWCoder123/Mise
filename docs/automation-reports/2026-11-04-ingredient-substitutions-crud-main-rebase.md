# Ingredient substitutions CRUD main rebase (2026-11-04)

## Summary

Rebase of open #337 (`cursor/mise-ingredient-substitutions-crud` @ `63a2329f`) onto
`origin/main` @ `78da7376` (MISE-005A). Cherry-pick was clean against
MISE-004C purchase-line ledger and MISE-005A locale pinning.

## Changes relative to #337

- Migration renamed from `20260901230000_…` to
  `20261104233000_ingredient_substitution_manager_authority.sql` so hosted
  tenants that already applied MISE-004C (`20260903120000`) receive a forward
  additive migration rather than a back-dated version between applied files.
- Migration static test path updated to match.
- Demo schema bump remains 13 → 14 for seeded ingredient substitutions;
  `purchaseLines` from MISE-004C is preserved.

## Product behavior (unchanged from #337)

- Manager+ SECURITY DEFINER RPCs: upsert / verify / reject / expire
- Clients remain SELECT-only on `ingredient_substitutions`
- Verified same-canonical-unit ratios only; auditable
- Settings → Ingredient substitutions screen (EN / ES / zh-Hans)
- Demo seeds + export parity
- Does **not** consume ratios in receive/depletion (pairs with open #1097)

## Supersedes

Open #337 once this tip lands.
