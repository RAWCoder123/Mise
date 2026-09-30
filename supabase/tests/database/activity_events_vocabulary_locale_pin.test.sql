-- MISE-005CZ: activity_events.event_type, category, actor_type, and status
-- CHECKs must keep the exact-token allowlists and pin ASCII shape under
-- COLLATE "C" so dump/restore cannot accept an activity-vocabulary
-- identity the restored C-locale gate would refuse.
begin;
select plan(90);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_event_type_check'
  ),
  'activity_events_event_type_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_event_type_check'
  ),
  'event_type in \(''forecast_updated'', ''prep_plan_updated'', ''inventory_risk_detected'', ''physical_count_requested'', ''supplier_prices_checked'', ''order_prepared'', ''order_approved'', ''order_sent'', ''supplier_confirmation_received'', ''delivery_expected'', ''delivery_logged'', ''invoice_discrepancy_detected'', ''waste_analysis_completed'', ''staff_schedule_analyzed'', ''staffing_gap_detected'', ''pos_sync_completed'', ''reservation_forecast_updated'', ''customer_review_trend_detected'', ''menu_item_performance_analyzed'', ''task_created'', ''task_completed'', ''task_reopened'', ''task_unblocked'', ''automation_failed'', ''approval_required'', ''recommendation_created'', ''recommendation_dismissed'', ''recommendation_outcome_measured'', ''restaurant_memory_updated'', ''inventory_count_recorded'', ''purchase_lines_recorded'', ''purchase_line_confidence_downgraded''\)',
  'activity_events event_type CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_event_type_check'
  ),
  'event_type collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'activity_events event_type CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_category_check'
  ),
  'activity_events_category_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_category_check'
  ),
  'category in \(''inventory'', ''orders'', ''sales'', ''team'', ''tasks'', ''waste'', ''approvals'', ''integrations'', ''memory'', ''system''\)',
  'activity_events category CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_category_check'
  ),
  'category collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'activity_events category CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_actor_type_check'
  ),
  'activity_events_actor_type_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_actor_type_check'
  ),
  'actor_type in \(''mise'', ''user'', ''integration'', ''system''\)',
  'activity_events actor_type CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_actor_type_check'
  ),
  'actor_type collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'activity_events actor_type CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_status_check'
  ),
  'activity_events_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_status_check'
  ),
  'status in \(''monitoring'', ''prepared'', ''waiting_for_approval'', ''scheduled'', ''sent'', ''confirmed'', ''completed'', ''failed'', ''could_not_verify'', ''partially_completed'', ''cancelled'', ''reversed''\)',
  'activity_events status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_status_check'
  ),
  'status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'activity_events status CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('forecast_updated' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token forecast_updated matches under COLLATE C'
);

select is(
  ('prep_plan_updated' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token prep_plan_updated matches under COLLATE C'
);

select is(
  ('inventory_risk_detected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token inventory_risk_detected matches under COLLATE C'
);

select is(
  ('physical_count_requested' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token physical_count_requested matches under COLLATE C'
);

select is(
  ('supplier_prices_checked' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token supplier_prices_checked matches under COLLATE C'
);

select is(
  ('order_prepared' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token order_prepared matches under COLLATE C'
);

select is(
  ('order_approved' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token order_approved matches under COLLATE C'
);

select is(
  ('order_sent' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token order_sent matches under COLLATE C'
);

select is(
  ('supplier_confirmation_received' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token supplier_confirmation_received matches under COLLATE C'
);

select is(
  ('delivery_expected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token delivery_expected matches under COLLATE C'
);

select is(
  ('delivery_logged' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token delivery_logged matches under COLLATE C'
);

select is(
  ('invoice_discrepancy_detected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token invoice_discrepancy_detected matches under COLLATE C'
);

select is(
  ('waste_analysis_completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token waste_analysis_completed matches under COLLATE C'
);

select is(
  ('staff_schedule_analyzed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token staff_schedule_analyzed matches under COLLATE C'
);

select is(
  ('staffing_gap_detected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token staffing_gap_detected matches under COLLATE C'
);

select is(
  ('pos_sync_completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token pos_sync_completed matches under COLLATE C'
);

select is(
  ('reservation_forecast_updated' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token reservation_forecast_updated matches under COLLATE C'
);

select is(
  ('customer_review_trend_detected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token customer_review_trend_detected matches under COLLATE C'
);

select is(
  ('menu_item_performance_analyzed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token menu_item_performance_analyzed matches under COLLATE C'
);

select is(
  ('task_created' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token task_created matches under COLLATE C'
);

select is(
  ('task_completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token task_completed matches under COLLATE C'
);

select is(
  ('task_reopened' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token task_reopened matches under COLLATE C'
);

select is(
  ('task_unblocked' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token task_unblocked matches under COLLATE C'
);

select is(
  ('automation_failed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token automation_failed matches under COLLATE C'
);

select is(
  ('approval_required' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token approval_required matches under COLLATE C'
);

select is(
  ('recommendation_created' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token recommendation_created matches under COLLATE C'
);

select is(
  ('recommendation_dismissed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token recommendation_dismissed matches under COLLATE C'
);

select is(
  ('recommendation_outcome_measured' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token recommendation_outcome_measured matches under COLLATE C'
);

select is(
  ('restaurant_memory_updated' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token restaurant_memory_updated matches under COLLATE C'
);

select is(
  ('inventory_count_recorded' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token inventory_count_recorded matches under COLLATE C'
);

select is(
  ('purchase_lines_recorded' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token purchase_lines_recorded matches under COLLATE C'
);

select is(
  ('purchase_line_confidence_downgraded' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token purchase_line_confidence_downgraded matches under COLLATE C'
);

select is(
  ('forecast updated' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced event_type token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty event_type token is rejected under COLLATE C'
);

select is(
  ('forecast_updated!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated event_type token is rejected under COLLATE C'
);

select is(
  (E'forecast_update\u00d0' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII event_type token is rejected under COLLATE C'
);

select is(
  ('forecast_updated' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('prep_plan_updated' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('inventory_risk_detected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('physical_count_requested' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('supplier_prices_checked' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('order_prepared' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('order_approved' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('order_sent' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('supplier_confirmation_received' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('delivery_expected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('delivery_logged' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('invoice_discrepancy_detected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('waste_analysis_completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('staff_schedule_analyzed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('staffing_gap_detected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('pos_sync_completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('reservation_forecast_updated' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('customer_review_trend_detected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('menu_item_performance_analyzed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('task_created' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('task_completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('task_reopened' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('task_unblocked' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('automation_failed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('approval_required' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('recommendation_created' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('recommendation_dismissed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('recommendation_outcome_measured' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('restaurant_memory_updated' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('inventory_count_recorded' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('purchase_lines_recorded' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('purchase_line_confidence_downgraded' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted event_type tokens match under COLLATE C'
);

select is(
  ('inventory' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token inventory matches under COLLATE C'
);

select is(
  ('orders' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token orders matches under COLLATE C'
);

select is(
  ('sales' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token sales matches under COLLATE C'
);

select is(
  ('team' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token team matches under COLLATE C'
);

select is(
  ('tasks' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token tasks matches under COLLATE C'
);

select is(
  ('waste' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token waste matches under COLLATE C'
);

select is(
  ('approvals' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token approvals matches under COLLATE C'
);

select is(
  ('integrations' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token integrations matches under COLLATE C'
);

select is(
  ('memory' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token memory matches under COLLATE C'
);

select is(
  ('system' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token system matches under COLLATE C'
);

select is(
  ('inventory orders' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced category token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty category token is rejected under COLLATE C'
);

select is(
  ('inventory!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated category token is rejected under COLLATE C'
);

select is(
  (E'inventor\u00ff' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII category token is rejected under COLLATE C'
);

select is(
  ('inventory' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('orders' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('sales' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('team' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('tasks' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('waste' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('approvals' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('integrations' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('memory' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('system' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted category tokens match under COLLATE C'
);

select is(
  ('mise' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token mise matches under COLLATE C'
);

select is(
  ('user' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token user matches under COLLATE C'
);

select is(
  ('integration' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token integration matches under COLLATE C'
);

select is(
  ('system' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token system actor matches under COLLATE C'
);

select is(
  ('mise user' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced actor_type token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty actor_type token is rejected under COLLATE C'
);

select is(
  ('mise!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated actor_type token is rejected under COLLATE C'
);

select is(
  (E'mis\u00e9' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII actor_type token is rejected under COLLATE C'
);

select is(
  ('mise' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('user' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('integration' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('system' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted actor_type tokens match under COLLATE C'
);

select is(
  ('monitoring' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token monitoring matches under COLLATE C'
);

select is(
  ('prepared' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token prepared matches under COLLATE C'
);

select is(
  ('waiting_for_approval' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token waiting_for_approval matches under COLLATE C'
);

select is(
  ('scheduled' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token scheduled matches under COLLATE C'
);

select is(
  ('sent' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token sent matches under COLLATE C'
);

select is(
  ('confirmed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token confirmed matches under COLLATE C'
);

select is(
  ('completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token completed matches under COLLATE C'
);

select is(
  ('failed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token failed matches under COLLATE C'
);

select is(
  ('could_not_verify' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token could_not_verify matches under COLLATE C'
);

select is(
  ('partially_completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token partially_completed matches under COLLATE C'
);

select is(
  ('cancelled' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token cancelled matches under COLLATE C'
);

select is(
  ('reversed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token reversed matches under COLLATE C'
);

select is(
  ('waiting for approval' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced status token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty status token is rejected under COLLATE C'
);

select is(
  ('completed!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated status token is rejected under COLLATE C'
);

select is(
  (E'complet\u00e9d' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII status token is rejected under COLLATE C'
);

select is(
  ('monitoring' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('prepared' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('waiting_for_approval' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('scheduled' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('sent' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('confirmed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('failed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('could_not_verify' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('partially_completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('cancelled' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('reversed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted status tokens match under COLLATE C'
);

select * from finish();
rollback;
