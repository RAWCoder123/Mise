# Recipe confirmed-by evidence tip (2026-11-27)

## Gap

`menu_items.recipe_confirmed_by` is nullable for account-deletion anonymization
(`ON DELETE SET NULL`). Soft CHECK `menu_items_recipe_authority_check` requires
`recipe_confirmed_revision` and `recipe_confirmed_at` together, but still
allows a confirmed row with `recipe_confirmed_by` null. Hosted
`confirm_recipe_complete` stamps `auth.uid()` via UPDATE; direct INSERTs can
still mint unattributable confirmed recipes.

## Change

- Domain `validateRecipeConfirmedByEvidence` (`missing_recipe_confirmed_by`)
- Additive BEFORE INSERT tip only (no NOT NULL / confirmation-implies-actor CHECK)
- pgTAP plan=9 (null confirmer reject, attributed accept, unconfirmed accept,
  UPDATE escape, anonymization preserve)

## Alone-OK

Orthogonal to mise_actions / restaurant-memory / activity / audit-log actor
tips (#1298–#1306) and recipe ASCII-C / locale pins. Does not rewrite
`confirm_recipe_complete`. Existing fixtures INSERT unconfirmed menu items,
then UPDATE with `recipe_confirmed_by` set.

## Verification

- `npm run typecheck`
- focused recipe-confirmed-by suite
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run supabase:test` when Docker is available
