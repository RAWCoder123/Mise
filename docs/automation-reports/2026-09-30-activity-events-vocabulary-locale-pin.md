# MISE-005CZ: pin activity_events event_type / category / actor_type / status CHECKs to COLLATE C

Date: 2026-09-30
Branch: `cursor/mise-activity-events-vocabulary-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `activity_events.event_type`, `category`, `actor_type`, and
`status` allowlists with the exact-token contracts plus ASCII shape under
COLLATE `"C"`:

```sql
event_type in (
  'forecast_updated',
  'prep_plan_updated',
  'inventory_risk_detected',
  'physical_count_requested',
  'supplier_prices_checked',
  'order_prepared',
  'order_approved',
  'order_sent',
  'supplier_confirmation_received',
  'delivery_expected',
  'delivery_logged',
  'invoice_discrepancy_detected',
  'waste_analysis_completed',
  'staff_schedule_analyzed',
  'staffing_gap_detected',
  'pos_sync_completed',
  'reservation_forecast_updated',
  'customer_review_trend_detected',
  'menu_item_performance_analyzed',
  'task_created',
  'task_completed',
  'task_reopened',
  'task_unblocked',
  'automation_failed',
  'approval_required',
  'recommendation_created',
  'recommendation_dismissed',
  'recommendation_outcome_measured',
  'restaurant_memory_updated',
  'inventory_count_recorded',
  'purchase_lines_recorded',
  'purchase_line_confidence_downgraded'
)
and event_type collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'

category in (
  'inventory',
  'orders',
  'sales',
  'team',
  'tasks',
  'waste',
  'approvals',
  'integrations',
  'memory',
  'system'
)
and category collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'

actor_type in (
  'mise',
  'user',
  'integration',
  'system'
)
and actor_type collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'

status in (
  'monitoring',
  'prepared',
  'waiting_for_approval',
  'scheduled',
  'sent',
  'confirmed',
  'completed',
  'failed',
  'could_not_verify',
  'partially_completed',
  'cancelled',
  'reversed'
)
and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (append_activity_event / capture triggers /
restaurant-task activity / purchase-line activity / recalculation activity):

- `event_type`: hosted writers mint allowlisted tokens only (tasks,
  recommendations, POS sync, purchase lines, recalculation, inventory)
- `category`: inventory / orders / sales / team / tasks / waste / approvals /
  integrations / memory / system
- `actor_type`: mise / user / integration / system
- `status`: monitoring through reversed lifecycle tokens

Exact-token allowlists are preserved; this tip adds the COLLATE C ASCII shape
gate alongside each.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pins cover
`restaurant_memories` vocabulary (#511) and `mise_actions` lifecycle (#510)
and deliberately left `activity_events.event_type` / `category` /
`actor_type` / `status` on bare IN only. `idempotency_key` is avoided without
writer/charset work. Without a dedicated COLLATE C shape CHECK, dump/restore
under LC_CTYPE drift can accept activity-vocabulary bytes the restored
C-locale path would refuse — or the reverse — breaking activity-feed
continuity across restore.

## Scope

- CHECK-only on `public.activity_events.event_type`, `category`,
  `actor_type`, `status`
- Does **not** rewrite append_activity_event / capture triggers / restaurant
  task activity writers
- Does **not** touch `idempotency_key` (needs writer/charset)
- Does **not** touch `restaurant_memories` (#511), `mise_actions` (#510), or
  `operational_issues` (#507–#509)
- Alone on main OK; timestamp after #511 (`20260930140000`)

## Verification

- `npm run typecheck` pass
- focused `tests/activityEventsVocabularyLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (withTimeout baseline; includes
  the three new MISE-005CZ static checks)
- pgTAP fixture committed (plan 90 from 90 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930140000_mise_005cz_activity_events_vocabulary_locale_pin.sql`
- `supabase/tests/database/activity_events_vocabulary_locale_pin.test.sql`
- `tests/activityEventsVocabularyLocalePin.test.ts`
- `docs/automation-reports/2026-09-30-activity-events-vocabulary-locale-pin.md`
