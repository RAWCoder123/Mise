# Restaurant autonomy-rule updated_by INSERT evidence (2026-11-27)

## Gap

`restaurant_autonomy_rules.updated_by` is nullable so account-deletion
anonymization can clear only the deleted operator's auth identity
(`ON DELETE SET NULL`). Hosted `public.upsert_restaurant_autonomy_rule`
already stamps `auth.uid()` into `updated_by` on INSERT, but direct inserts
(including service_role) can still mint unattributable autonomy rules with
`updated_by = null`. The sibling created_by tip (#1303) closed creator
attribution and explicitly deferred updater attribution on INSERT.

## Change

- Domain: `validateRestaurantAutonomyRuleUpdatedByEvidence` → `missing_updated_by`
- Additive BEFORE INSERT tip only on `public.restaurant_autonomy_rules`
- No NOT NULL / tighter CHECK (preserves anonymization UPDATEs)
- Does not rewrite `upsert_restaurant_autonomy_rule`
- pgTAP plan = 8 (derived from assertion call sites)
- Null-updated_by reject probe stamps `created_by` so it stays Alone-OK
  beside #1303

## Alone-OK

Orthogonal to tip stacks #1263–#1316, autonomy-rule created_by tip (#1303),
autonomy locale / ASCII-C pins, and audit-log / activity / inventory actor
tips. Does not invent unconditional table-level NOT NULL.

Contested merge: #1303 null-created_by probe should stamp `updated_by` once
this lands (otherwise both BEFORE INSERT tips may race on null/null).

## Verification

- `npm run typecheck`
- focused `restaurantAutonomyRuleUpdatedByEvidence` suite
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- Docker `npm run supabase:test` when available
