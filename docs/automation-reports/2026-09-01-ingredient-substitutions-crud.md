# 2026-09-01 Ingredient substitutions manager CRUD

Tip: `cursor/mise-ingredient-substitutions-crud`  
Base: `origin/main` @ `20b28e5`

## Problem

`public.ingredient_substitutions` already existed with SELECT-only RLS and export coverage, but managers had no authenticated write path, demo seeds, or Settings UI. Receive-line substitutes (#293) are ad-hoc same-unit swaps and do not populate this ratio table.

## Solution

- Additive migration `20260901230000_ingredient_substitution_manager_authority.sql` with manager+ SECURITY DEFINER RPCs:
  - `upsert_ingredient_substitution` (draft create/edit)
  - `verify_ingredient_substitution`
  - `reject_ingredient_substitution`
  - `expire_ingredient_substitution`
- Requires verified matching canonical units on both inventory items; blocks overlapping active verified pairs; audit logs on every mutation; no direct table DML for authenticated clients.
- Domain helpers for normalize/ratio conversion/active listing.
- Demo schema v14 seeds + repository/export parity.
- Settings → Ingredient substitutions screen (EN/ES/zh-Hans) for draft create and verify/reject/expire.

## Verification

- `npm run typecheck`
- `node --test --import tsx tests/ingredientSubstitutions*.test.ts` — 8/8 pass
- `npm test` — 640 pass / 0 fail / 7 cancelled
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`

## Follow-ups

- Deploy migration before hosted tenants can write.
- Consume verified ratios in receive / depletion once those stacks land (do not invent MOQ/lead-time/expiration columns).
- Recipe yield WRITE still needs a separate authority RPC.
