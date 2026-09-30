# MISE-005CY: pin restaurant_memories memory_type / scope / status CHECKs to COLLATE C

Date: 2026-09-30
Branch: `cursor/mise-restaurant-memories-memory-type-scope-status-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `restaurant_memories.memory_type`, `scope`, and `status`
allowlists with the exact-token contracts plus ASCII shape under COLLATE `"C"`:

```sql
memory_type in (
  'demand_pattern',
  'prep_habit',
  'waste_pattern',
  'supplier_reliability',
  'staff_timing',
  'safety_stock_preference',
  'service_window',
  'approval_preference',
  'seasonal_effect',
  'weather_effect',
  'local_event_effect',
  'menu_dependency',
  'operational_exception',
  'rejected_recommendation',
  'edited_quantity',
  'recurring_bottleneck',
  'action_outcome'
)
and memory_type collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'

scope in (
  'restaurant',
  'location',
  'supplier',
  'item',
  'team',
  'service_period'
)
and scope collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'

status in (
  'active',
  'confirmed',
  'corrected',
  'dismissed',
  'forgotten',
  'disabled'
)
and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (supplier-delivery outcomes / decide_restaurant_memory in
operational_backend_foundation and later durable-supplier identity):

- `memory_type`: `supplier_reliability` (active hosted mint); remaining
  allowlisted types are reserved learning vocabulary
- `scope`: `supplier` on delivery-outcome mint; default `restaurant`
- `status`: `active` on insert; `confirmed` / `corrected` / `dismissed` /
  `forgotten` / `disabled` via `decide_restaurant_memory`

Exact-token allowlists are preserved; this tip adds the COLLATE C ASCII shape
gate alongside each.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pins cover
`mise_actions` lifecycle (#510) and operational_issues category/severity/
status (#507–#509) and deliberately left `restaurant_memories.memory_type` /
`scope` / `status` on bare IN only. `dedupe_key` is avoided without
writer/charset work. Without a dedicated COLLATE C shape CHECK, dump/restore
under LC_CTYPE drift can accept memory-vocabulary bytes the restored C-locale
path would refuse — or the reverse — breaking memory type, scope, and status
continuity across restore.

## Scope

- CHECK-only on `public.restaurant_memories.memory_type`, `scope`, `status`
- Does **not** rewrite supplier-delivery / decide_restaurant_memory writers
- Does **not** touch `dedupe_key` (needs writer/charset)
- Does **not** touch `mise_actions` (#510), `operational_issues` (#507–#509),
  or `activity_events` allowlists
- Alone on main OK; timestamp after #510 (`20260930130000`)

## Verification

- `npm run typecheck` pass
- focused `tests/restaurantMemoriesMemoryTypeScopeStatusLocalePin.test.ts`
  3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (withTimeout baseline; includes
  the three new MISE-005CY static checks)
- pgTAP fixture committed (plan 53 from 53 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930130000_mise_005cy_restaurant_memories_memory_type_scope_status_locale_pin.sql`
- `supabase/tests/database/restaurant_memories_memory_type_scope_status_locale_pin.test.sql`
- `tests/restaurantMemoriesMemoryTypeScopeStatusLocalePin.test.ts`
- `docs/automation-reports/2026-09-30-restaurant-memories-memory-type-scope-status-locale-pin.md`
