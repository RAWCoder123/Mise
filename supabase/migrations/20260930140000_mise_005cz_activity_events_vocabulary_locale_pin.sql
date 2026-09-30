-- MISE-005CZ: pin activity_events.event_type, category, actor_type, and
-- status CHECKs to COLLATE "C", preserving the exact-token allowlists.
--
-- activity_events stores the operator activity vocabulary under bare IN
-- allowlists. Current contracts (foundation + shared_restaurant_tasks +
-- MISE-004C purchase line ledger):
--   event_type in (
--     'forecast_updated', 'prep_plan_updated', 'inventory_risk_detected',
--     'physical_count_requested', 'supplier_prices_checked',
--     'order_prepared', 'order_approved', 'order_sent',
--     'supplier_confirmation_received', 'delivery_expected',
--     'delivery_logged', 'invoice_discrepancy_detected',
--     'waste_analysis_completed', 'staff_schedule_analyzed',
--     'staffing_gap_detected', 'pos_sync_completed',
--     'reservation_forecast_updated',
--     'customer_review_trend_detected',
--     'menu_item_performance_analyzed', 'task_created',
--     'task_completed', 'task_reopened', 'task_unblocked',
--     'automation_failed', 'approval_required',
--     'recommendation_created', 'recommendation_dismissed',
--     'recommendation_outcome_measured', 'restaurant_memory_updated',
--     'inventory_count_recorded', 'purchase_lines_recorded',
--     'purchase_line_confidence_downgraded'
--   )
--   category in (
--     'inventory', 'orders', 'sales', 'team', 'tasks', 'waste',
--     'approvals', 'integrations', 'memory', 'system'
--   )
--   actor_type in ('mise', 'user', 'integration', 'system')
--   status in (
--     'monitoring', 'prepared', 'waiting_for_approval', 'scheduled',
--     'sent', 'confirmed', 'completed', 'failed', 'could_not_verify',
--     'partially_completed', 'cancelled', 'reversed'
--   )
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only
-- (append_activity_event / capture triggers / restaurant-task activity /
-- purchase-line activity / recalculation activity).
--
-- event_type gates operator-feed routing and attention. category gates
-- inventory / orders / sales / team / tasks / waste / approvals /
-- integrations / memory / system filtering. actor_type gates mise / user /
-- integration / system attribution. status gates monitoring through
-- reversed lifecycle. POSIX character classes follow database LC_CTYPE.
-- This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on
-- this cluster; open sibling pins cover restaurant_memories (#511) and
-- mise_actions (#510) vocabulary and deliberately left activity_events
-- event_type / category / actor_type / status on bare IN. idempotency_key
-- is avoided without writer/charset work.
--
-- If LC_CTYPE drifted under a bare-IN activity vocabulary CHECK,
-- dump/restore could accept event-type / category / actor-type / status
-- bytes the restored C-locale path (and sibling machine-identity gates)
-- would refuse — or the reverse — breaking activity-feed continuity
-- across restore.
--
-- Scope:
--   - Replace activity_events_event_type_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
--   - Replace activity_events_category_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
--   - Replace activity_events_actor_type_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
--   - Replace activity_events_status_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite append_activity_event / capture triggers / restaurant
-- task activity writers, idempotency_key (needs writer/charset), title /
-- summary / source / trigger free text, restaurant_memories (#511),
-- mise_actions (#510), or operational_issues (#507–#509).
-- Timestamp after MISE-005CY (#511).

alter table public.activity_events
  drop constraint if exists activity_events_event_type_check;

alter table public.activity_events
  add constraint activity_events_event_type_check
  check (
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
  );

comment on constraint activity_events_event_type_check
  on public.activity_events is
  'MISE-005CZ: exact event_type allowlist plus ASCII shape under COLLATE "C". Activity event type.';

comment on column public.activity_events.event_type is
  'Activity event type. Allowed values: forecast_updated, prep_plan_updated, inventory_risk_detected, physical_count_requested, supplier_prices_checked, order_prepared, order_approved, order_sent, supplier_confirmation_received, delivery_expected, delivery_logged, invoice_discrepancy_detected, waste_analysis_completed, staff_schedule_analyzed, staffing_gap_detected, pos_sync_completed, reservation_forecast_updated, customer_review_trend_detected, menu_item_performance_analyzed, task_created, task_completed, task_reopened, task_unblocked, automation_failed, approval_required, recommendation_created, recommendation_dismissed, recommendation_outcome_measured, restaurant_memory_updated, inventory_count_recorded, purchase_lines_recorded, purchase_line_confidence_downgraded under COLLATE "C".';

alter table public.activity_events
  drop constraint if exists activity_events_category_check;

alter table public.activity_events
  add constraint activity_events_category_check
  check (
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
  );

comment on constraint activity_events_category_check
  on public.activity_events is
  'MISE-005CZ: exact inventory/orders/sales/team/tasks/waste/approvals/integrations/memory/system allowlist plus ASCII shape under COLLATE "C". Activity category.';

comment on column public.activity_events.category is
  'Activity category. Allowed values: inventory, orders, sales, team, tasks, waste, approvals, integrations, memory, system under COLLATE "C".';

alter table public.activity_events
  drop constraint if exists activity_events_actor_type_check;

alter table public.activity_events
  add constraint activity_events_actor_type_check
  check (
    actor_type in (
      'mise',
      'user',
      'integration',
      'system'
    )
    and actor_type collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint activity_events_actor_type_check
  on public.activity_events is
  'MISE-005CZ: exact mise/user/integration/system allowlist plus ASCII shape under COLLATE "C". Activity actor type.';

comment on column public.activity_events.actor_type is
  'Activity actor type. Allowed values: mise, user, integration, system under COLLATE "C".';

alter table public.activity_events
  drop constraint if exists activity_events_status_check;

alter table public.activity_events
  add constraint activity_events_status_check
  check (
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
  );

comment on constraint activity_events_status_check
  on public.activity_events is
  'MISE-005CZ: exact monitoring/prepared/waiting_for_approval/scheduled/sent/confirmed/completed/failed/could_not_verify/partially_completed/cancelled/reversed allowlist plus ASCII shape under COLLATE "C". Activity status.';

comment on column public.activity_events.status is
  'Activity status. Allowed values: monitoring, prepared, waiting_for_approval, scheduled, sent, confirmed, completed, failed, could_not_verify, partially_completed, cancelled, reversed under COLLATE "C".';
