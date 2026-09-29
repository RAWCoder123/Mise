# MISE-005CT: pin restaurant_autonomy_rules.operational_category CHECK to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-restaurant-autonomy-rules-operational-category-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `restaurant_autonomy_rules.operational_category` allowlist
(`inventory` / `orders` / `sales` / `team` / `waste` / `tasks` /
`integrations` / `settings`) with the exact-token contract plus ASCII shape
under COLLATE `"C"`:

```sql
operational_category in (
  'inventory',
  'orders',
  'sales',
  'team',
  'waste',
  'tasks',
  'integrations',
  'settings'
)
and operational_category collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (`services/domain/restaurantAutonomy.ts`
`AutonomyOperationalCategory` and `upsert_restaurant_autonomy_rule`):

- `inventory` — inventory automation ceilings
- `orders` — purchasing and supplier-send ceilings
- `sales` — sales/forecast automation ceilings
- `team` — staffing automation ceilings
- `waste` — waste analysis automation ceilings
- `tasks` — task-generation automation ceilings
- `integrations` — POS/email automation ceilings
- `settings` — settings/profile automation ceilings

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pin #503 covers
`restaurant_tasks.operational_category` under a different vocabulary and
deliberately left `restaurant_autonomy_rules.operational_category` on bare IN
only. Without a dedicated COLLATE C shape CHECK, dump/restore under LC_CTYPE
drift can accept autonomy-category bytes the restored C-locale path would
refuse — or the reverse — breaking Autonomy settings grouping across restore.

## Scope

- CHECK-only on `public.restaurant_autonomy_rules.operational_category`
- Does **not** rewrite `upsert_restaurant_autonomy_rule`
- Does **not** touch `restaurant_autonomy_rules_execute_guard`
- Does **not** touch `restaurant_tasks.operational_category` (#503)
- Does **not** touch free-form `action_type` / `supplier_name` /
  `communication_type`
- Does **not** touch other operational-foundation allowlists
  (`operational_issues` / `mise_actions` / `restaurant_memories` /
  `activity_events`)
- Alone on main OK; timestamp after #505 (`20260930080000`)

## Verification

- `npm run typecheck` pass
- focused `tests/restaurantAutonomyRulesOperationalCategoryLocalePin.test.ts`
  3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (withTimeout baseline; includes
  the three new MISE-005CT static checks)
- pgTAP fixture committed (plan 16 from 16 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930080000_mise_005ct_restaurant_autonomy_rules_operational_category_locale_pin.sql`
- `supabase/tests/database/restaurant_autonomy_rules_operational_category_locale_pin.test.sql`
- `tests/restaurantAutonomyRulesOperationalCategoryLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-restaurant-autonomy-rules-operational-category-locale-pin.md`
