# Restaurant autonomy-rule created_by INSERT evidence (2026-11-27)

## Gap

`restaurant_autonomy_rules.created_by` is nullable so account-deletion
anonymization can clear only the deleted operator's auth identity
(`ON DELETE SET NULL`). Hosted `public.upsert_restaurant_autonomy_rule`
already stamps `auth.uid()` into `created_by` on INSERT, but direct inserts
(including service_role) can still mint unattributable autonomy rules with
`created_by = null`.

## Change

- Domain: `validateRestaurantAutonomyRuleCreatedByEvidence` → `missing_created_by`
- Additive BEFORE INSERT tip only on `public.restaurant_autonomy_rules`
- No NOT NULL / tighter CHECK (preserves anonymization UPDATEs)
- Does not rewrite `upsert_restaurant_autonomy_rule`
- pgTAP plan = 8 (derived from assertion call sites)

## Alone-OK

Orthogonal to autonomy locale / ASCII-C pins, audit-log actor tip (#1302),
mise-action / memory / activity / inventory actor tips. Does not invent
unconditional table-level NOT NULL. Does not require `updated_by` on INSERT.

## Verification

- `npm run typecheck`
- focused `restaurantAutonomyRuleCreatedByEvidence` suite
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- Docker `npm run supabase:test` when available
