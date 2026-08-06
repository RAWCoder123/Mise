-- Mise operational-backend foundation.
--
-- This migration adds the durable, tenant-scoped records required to trace an
-- operating loop from signal -> recommendation -> action -> activity ->
-- delivery -> outcome -> memory. Public operational records are readable only
-- through membership-scoped RLS. Clients cannot forge activity or mutate audit
-- history directly; state changes go through bounded RPCs or existing guarded
-- workflows.

do $$
begin
  alter table public.purchase_recommendations
    add constraint purchase_recommendations_restaurant_id_id_key
    unique (restaurant_id, id);
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.inventory_events
    add constraint inventory_events_restaurant_id_id_key
    unique (restaurant_id, id);
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.operational_issues (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  location_id uuid,
  category text not null check (category in (
    'inventory', 'orders', 'sales', 'team', 'waste', 'integrations', 'tasks', 'system'
  )),
  severity text not null check (severity in ('info', 'watch', 'warning', 'critical')),
  title text not null check (length(trim(title)) between 1 and 160),
  explanation text not null check (length(trim(explanation)) between 1 and 2000),
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  first_detected_at timestamptz not null,
  last_detected_at timestamptz not null,
  deadline timestamptz,
  status text not null default 'open' check (status in (
    'open', 'monitoring', 'action_prepared', 'resolved', 'dismissed', 'expired'
  )),
  related_entity_type text,
  related_entity_id text,
  dedupe_key text not null check (length(trim(dedupe_key)) between 1 and 240),
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  unique (restaurant_id, dedupe_key),
  constraint operational_issues_location_fkey
    foreign key (restaurant_id, location_id)
    references public.pos_locations (restaurant_id, id) on delete set null,
  constraint operational_issues_window_check
    check (last_detected_at >= first_detected_at),
  constraint operational_issues_evidence_bound_check
    check (pg_column_size(evidence) <= 32768)
);

create table if not exists public.mise_actions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  location_id uuid,
  issue_id uuid,
  recommendation_id uuid,
  action_type text not null check (action_type in (
    'create_internal_task', 'recalculate_forecast', 'update_prep_recommendation',
    'schedule_inventory_count', 'remind_employee', 'flag_menu_item_internally',
    'prepare_supplier_order_draft', 'send_supplier_order', 'change_schedule',
    'contact_external_party', 'modify_menu_availability', 'change_price',
    'send_staff_communication', 'send_supplier_communication',
    'issue_refund_or_credit', 'change_permissions_or_rules',
    'prepare_inventory_adjustment', 'measure_outcome'
  )),
  execution_mode text not null check (execution_mode in ('observe', 'recommend', 'prepare', 'execute')),
  status text not null check (status in (
    'prepared', 'waiting_for_approval', 'approved', 'rejected', 'executing',
    'executed', 'failed', 'cancelled', 'reversed', 'unverified'
  )),
  autonomy_level smallint not null check (autonomy_level between 1 and 5),
  trigger_type text,
  trigger_reference text,
  reason text,
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  confidence numeric check (confidence is null or confidence between 0 and 1),
  expected_impact jsonb,
  financial_impact_cents bigint,
  requested_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  executed_at timestamptz,
  result jsonb,
  error_code text,
  error_message text,
  rollback_reference text,
  idempotency_key text not null check (length(trim(idempotency_key)) between 1 and 240),
  correlation_id uuid not null default gen_random_uuid(),
  causation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  unique (restaurant_id, idempotency_key),
  constraint mise_actions_location_fkey
    foreign key (restaurant_id, location_id)
    references public.pos_locations (restaurant_id, id) on delete set null,
  constraint mise_actions_issue_fkey
    foreign key (restaurant_id, issue_id)
    references public.operational_issues (restaurant_id, id) on delete set null,
  constraint mise_actions_recommendation_fkey
    foreign key (restaurant_id, recommendation_id)
    references public.purchase_recommendations (restaurant_id, id) on delete set null,
  constraint mise_actions_evidence_bound_check
    check (pg_column_size(evidence) <= 32768),
  constraint mise_actions_expected_impact_bound_check
    check (expected_impact is null or (jsonb_typeof(expected_impact) = 'object' and pg_column_size(expected_impact) <= 16384)),
  constraint mise_actions_result_bound_check
    check (result is null or (jsonb_typeof(result) = 'object' and pg_column_size(result) <= 16384))
);

create table if not exists public.action_outcomes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  action_id uuid not null,
  expected_result jsonb not null check (jsonb_typeof(expected_result) = 'object'),
  actual_result jsonb not null check (jsonb_typeof(actual_result) = 'object'),
  variance jsonb not null default '{}'::jsonb check (jsonb_typeof(variance) = 'object'),
  measured_at timestamptz not null,
  lesson text,
  idempotency_key text not null check (length(trim(idempotency_key)) between 1 and 240),
  created_at timestamptz not null default now(),
  unique (restaurant_id, id),
  unique (restaurant_id, idempotency_key),
  constraint action_outcomes_action_fkey
    foreign key (restaurant_id, action_id)
    references public.mise_actions (restaurant_id, id) on delete restrict,
  constraint action_outcomes_payload_bound_check
    check (
      pg_column_size(expected_result) <= 16384
      and pg_column_size(actual_result) <= 16384
      and pg_column_size(variance) <= 16384
    )
);

create table if not exists public.restaurant_memories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  location_id uuid,
  memory_type text not null check (memory_type in (
    'demand_pattern', 'prep_habit', 'waste_pattern', 'supplier_reliability',
    'staff_timing', 'safety_stock_preference', 'service_window',
    'approval_preference', 'seasonal_effect', 'weather_effect',
    'local_event_effect', 'menu_dependency', 'operational_exception',
    'rejected_recommendation', 'edited_quantity', 'recurring_bottleneck',
    'action_outcome'
  )),
  statement text not null check (length(trim(statement)) between 1 and 1000),
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  confidence numeric not null check (confidence between 0 and 1),
  first_observed_at timestamptz not null,
  last_updated_at timestamptz not null,
  scope text not null default 'restaurant' check (scope in ('restaurant', 'location', 'supplier', 'item', 'team', 'service_period')),
  source text not null check (length(trim(source)) between 1 and 120),
  affects_recommendations boolean not null default true,
  affects_automation boolean not null default false,
  status text not null default 'active' check (status in (
    'active', 'confirmed', 'corrected', 'dismissed', 'forgotten', 'disabled'
  )),
  correction text,
  corrected_by uuid references auth.users(id) on delete set null,
  corrected_at timestamptz,
  rule_reference text,
  dedupe_key text not null check (length(trim(dedupe_key)) between 1 and 240),
  created_at timestamptz not null default now(),
  unique (restaurant_id, id),
  unique (restaurant_id, dedupe_key),
  constraint restaurant_memories_location_fkey
    foreign key (restaurant_id, location_id)
    references public.pos_locations (restaurant_id, id) on delete set null,
  constraint restaurant_memories_observation_window_check
    check (last_updated_at >= first_observed_at),
  constraint restaurant_memories_evidence_bound_check
    check (pg_column_size(evidence) <= 32768)
);

create table if not exists public.restaurant_autonomy_rules (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  location_id uuid,
  action_type text not null,
  operational_category text not null check (operational_category in (
    'inventory', 'orders', 'sales', 'team', 'waste', 'tasks', 'integrations', 'settings'
  )),
  maximum_autonomy_level smallint not null default 2 check (maximum_autonomy_level between 1 and 5),
  requires_approval boolean not null default true,
  enabled boolean not null default false,
  spend_limit_cents bigint check (spend_limit_cents is null or spend_limit_cents >= 0),
  supplier_name text,
  communication_type text,
  allowed_start_time time,
  allowed_end_time time,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  constraint restaurant_autonomy_rules_location_fkey
    foreign key (restaurant_id, location_id)
    references public.pos_locations (restaurant_id, id) on delete set null,
  constraint restaurant_autonomy_rules_scope_key
    unique nulls not distinct (
      restaurant_id, location_id, action_type, supplier_name, communication_type
    ),
  constraint restaurant_autonomy_rules_execute_guard
    check (
      maximum_autonomy_level < 4
      or enabled = false
      or requires_approval = true
      or action_type in (
        'create_internal_task', 'recalculate_forecast', 'update_prep_recommendation',
        'schedule_inventory_count', 'flag_menu_item_internally'
      )
    )
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  location_id uuid,
  event_type text not null check (event_type in (
    'forecast_updated', 'prep_plan_updated', 'inventory_risk_detected',
    'physical_count_requested', 'supplier_prices_checked', 'order_prepared',
    'order_approved', 'order_sent', 'supplier_confirmation_received',
    'delivery_expected', 'delivery_logged', 'invoice_discrepancy_detected',
    'waste_analysis_completed', 'staff_schedule_analyzed', 'staffing_gap_detected',
    'pos_sync_completed', 'reservation_forecast_updated',
    'customer_review_trend_detected', 'menu_item_performance_analyzed',
    'task_created', 'task_completed', 'automation_failed', 'approval_required',
    'recommendation_created', 'recommendation_dismissed',
    'recommendation_outcome_measured', 'restaurant_memory_updated',
    'inventory_count_recorded'
  )),
  category text not null check (category in (
    'inventory', 'orders', 'sales', 'team', 'waste', 'approvals',
    'integrations', 'memory', 'system'
  )),
  title text not null check (length(trim(title)) between 1 and 160),
  summary text not null check (length(trim(summary)) between 1 and 1000),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  source text not null check (length(trim(source)) between 1 and 80),
  actor_type text not null default 'mise' check (actor_type in ('mise', 'user', 'integration', 'system')),
  actor_user_id uuid references auth.users(id) on delete set null,
  trigger_type text not null check (length(trim(trigger_type)) between 1 and 120),
  trigger_reference text,
  evidence_references jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_references) = 'array'),
  source_systems text[] not null default array['mise']::text[] check (cardinality(source_systems) between 1 and 16),
  action_id uuid,
  recommendation_id uuid,
  autonomy_level smallint not null check (autonomy_level between 1 and 5),
  confidence numeric check (confidence is null or confidence between 0 and 1),
  status text not null check (status in (
    'monitoring', 'prepared', 'waiting_for_approval', 'scheduled', 'sent',
    'confirmed', 'completed', 'failed', 'could_not_verify',
    'partially_completed', 'cancelled', 'reversed'
  )),
  requires_attention boolean not null default false,
  attention_deadline timestamptz,
  related_entity_type text,
  related_entity_id text,
  parent_activity_id uuid,
  sequence_id text,
  correlation_id uuid not null default gen_random_uuid(),
  causation_id uuid,
  idempotency_key text not null check (length(trim(idempotency_key)) between 1 and 240),
  schema_version integer not null default 1 check (schema_version > 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  error_code text,
  error_message text,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  unique (restaurant_id, id),
  unique (restaurant_id, idempotency_key),
  constraint activity_events_location_fkey
    foreign key (restaurant_id, location_id)
    references public.pos_locations (restaurant_id, id) on delete set null,
  constraint activity_events_parent_fkey
    foreign key (restaurant_id, parent_activity_id)
    references public.activity_events (restaurant_id, id) on delete set null,
  constraint activity_events_evidence_bound_check
    check (pg_column_size(evidence_references) <= 32768),
  constraint activity_events_metadata_bound_check
    check (pg_column_size(metadata) <= 16384),
  constraint activity_events_resolution_check
    check (
      (resolved_at is null and resolved_by is null)
      or resolved_at is not null
    )
);

create table if not exists public.supplier_order_confirmations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  supplier_order_id uuid not null,
  confirmation_status text not null check (confirmation_status in (
    'acknowledged', 'changed', 'rejected', 'unverified'
  )),
  confirmation_reference text,
  expected_delivery_at timestamptz,
  normalized_details jsonb not null default '{}'::jsonb check (jsonb_typeof(normalized_details) = 'object'),
  received_at timestamptz not null,
  source text not null check (length(trim(source)) between 1 and 80),
  idempotency_key text not null check (length(trim(idempotency_key)) between 1 and 240),
  created_at timestamptz not null default now(),
  unique (restaurant_id, id),
  unique (restaurant_id, idempotency_key),
  constraint supplier_order_confirmations_order_fkey
    foreign key (restaurant_id, supplier_order_id)
    references public.supplier_orders (restaurant_id, id) on delete restrict,
  constraint supplier_order_confirmations_details_bound_check
    check (pg_column_size(normalized_details) <= 16384)
);

create table if not exists public.supplier_deliveries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  supplier_order_id uuid not null,
  status text not null default 'unverified' check (status in (
    'unverified', 'partially_received', 'received', 'discrepancy', 'failed'
  )),
  received_at timestamptz not null,
  verified_by uuid references auth.users(id) on delete set null,
  invoice_total numeric check (invoice_total is null or (invoice_total >= 0 and invoice_total <= 10000000)),
  discrepancy_total numeric check (discrepancy_total is null or abs(discrepancy_total) <= 10000000),
  notes text,
  client_delivery_id text not null check (length(trim(client_delivery_id)) between 1 and 200),
  idempotency_key text not null check (length(trim(idempotency_key)) between 1 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  unique (restaurant_id, client_delivery_id),
  unique (restaurant_id, idempotency_key),
  constraint supplier_deliveries_order_fkey
    foreign key (restaurant_id, supplier_order_id)
    references public.supplier_orders (restaurant_id, id) on delete restrict,
  constraint supplier_deliveries_notes_bound_check
    check (notes is null or length(notes) <= 2000)
);

create table if not exists public.supplier_delivery_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  delivery_id uuid not null,
  inventory_item_id uuid not null,
  ordered_quantity numeric check (ordered_quantity is null or (ordered_quantity >= 0 and ordered_quantity <= 1000000)),
  received_quantity numeric not null check (received_quantity >= 0 and received_quantity <= 1000000),
  damaged_quantity numeric not null default 0 check (damaged_quantity >= 0 and damaged_quantity <= received_quantity),
  missing_quantity numeric not null default 0 check (missing_quantity >= 0 and missing_quantity <= 1000000),
  canonical_unit text not null check (canonical_unit in ('g', 'ml', 'each')),
  substitution_inventory_item_id uuid,
  unit_price numeric check (unit_price is null or (unit_price >= 0 and unit_price <= 1000000)),
  discrepancy_reason text,
  inventory_event_id uuid,
  created_at timestamptz not null default now(),
  unique (restaurant_id, id),
  unique (restaurant_id, delivery_id, inventory_item_id),
  constraint supplier_delivery_items_delivery_fkey
    foreign key (restaurant_id, delivery_id)
    references public.supplier_deliveries (restaurant_id, id) on delete cascade,
  constraint supplier_delivery_items_inventory_fkey
    foreign key (restaurant_id, inventory_item_id)
    references public.inventory_items (restaurant_id, id) on delete restrict,
  constraint supplier_delivery_items_substitution_fkey
    foreign key (restaurant_id, substitution_inventory_item_id)
    references public.inventory_items (restaurant_id, id) on delete restrict,
  constraint supplier_delivery_items_event_fkey
    foreign key (restaurant_id, inventory_event_id)
    references public.inventory_events (restaurant_id, id) on delete restrict,
  constraint supplier_delivery_items_reason_bound_check
    check (discrepancy_reason is null or length(discrepancy_reason) <= 500)
);

create index if not exists activity_events_restaurant_occurred_idx
  on public.activity_events (restaurant_id, occurred_at desc, id desc);
create index if not exists activity_events_attention_idx
  on public.activity_events (restaurant_id, requires_attention, occurred_at desc)
  where requires_attention;
create index if not exists activity_events_sequence_idx
  on public.activity_events (restaurant_id, sequence_id, occurred_at)
  where sequence_id is not null;
create index if not exists operational_issues_open_idx
  on public.operational_issues (restaurant_id, status, severity, deadline);
create index if not exists mise_actions_status_idx
  on public.mise_actions (restaurant_id, status, created_at desc);
create index if not exists restaurant_memories_active_idx
  on public.restaurant_memories (restaurant_id, status, memory_type, last_updated_at desc);
create index if not exists supplier_deliveries_order_idx
  on public.supplier_deliveries (restaurant_id, supplier_order_id, received_at desc);

create or replace function private.reject_immutable_operational_record_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    and pg_catalog.current_setting(
      'mise.inventory_event_tenant_delete',
      true
    ) = 'true'
  then
    return old;
  end if;

  if tg_table_name = 'activity_events'
    and tg_op = 'UPDATE'
    and (
      old.actor_user_id is distinct from new.actor_user_id
      or old.resolved_by is distinct from new.resolved_by
    )
    and (new.actor_user_id is null or new.actor_user_id = old.actor_user_id)
    and (new.resolved_by is null or new.resolved_by = old.resolved_by)
    and (old.actor_user_id = new.actor_user_id or not exists (
      select 1 from auth.users auth_user where auth_user.id = old.actor_user_id
    ))
    and (old.resolved_by = new.resolved_by or not exists (
      select 1 from auth.users auth_user where auth_user.id = old.resolved_by
    ))
    and (
      pg_catalog.to_jsonb(new) - 'actor_user_id' - 'resolved_by'
    ) is not distinct from (
      pg_catalog.to_jsonb(old) - 'actor_user_id' - 'resolved_by'
    )
  then
    return new;
  end if;

  raise exception 'Operational audit records are append-only' using errcode = '55000';
end;
$$;

drop trigger if exists reject_activity_event_mutation on public.activity_events;
create trigger reject_activity_event_mutation
before update or delete on public.activity_events
for each row execute function private.reject_immutable_operational_record_mutation();

drop trigger if exists reject_action_outcome_mutation on public.action_outcomes;
create trigger reject_action_outcome_mutation
before update or delete on public.action_outcomes
for each row execute function private.reject_immutable_operational_record_mutation();

create or replace function private.append_activity_event(
  p_restaurant_id uuid,
  p_event_type text,
  p_category text,
  p_title text,
  p_summary text,
  p_occurred_at timestamptz,
  p_source text,
  p_actor_type text,
  p_actor_user_id uuid,
  p_trigger_type text,
  p_trigger_reference text,
  p_evidence_references jsonb,
  p_source_systems text[],
  p_action_id uuid,
  p_recommendation_id uuid,
  p_autonomy_level smallint,
  p_confidence numeric,
  p_status text,
  p_requires_attention boolean,
  p_attention_deadline timestamptz,
  p_related_entity_type text,
  p_related_entity_id text,
  p_sequence_id text,
  p_correlation_id uuid,
  p_causation_id uuid,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb,
  p_error_code text default null,
  p_error_message text default null,
  p_location_id uuid default null
)
returns public.activity_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.activity_events;
begin
  if p_restaurant_id is null
    or p_occurred_at is null
    or nullif(trim(p_idempotency_key), '') is null
    or jsonb_typeof(coalesce(p_evidence_references, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object'
  then
    raise exception 'Activity evidence is incomplete' using errcode = '22023';
  end if;

  insert into public.activity_events (
    restaurant_id, location_id, event_type, category, title, summary,
    occurred_at, source, actor_type, actor_user_id, trigger_type,
    trigger_reference, evidence_references, source_systems, action_id,
    recommendation_id, autonomy_level, confidence, status,
    requires_attention, attention_deadline, related_entity_type,
    related_entity_id, sequence_id, correlation_id, causation_id,
    idempotency_key, metadata, error_code, error_message
  ) values (
    p_restaurant_id, p_location_id, p_event_type, p_category,
    left(trim(p_title), 160), left(trim(p_summary), 1000), p_occurred_at,
    left(trim(p_source), 80), p_actor_type, p_actor_user_id,
    left(trim(p_trigger_type), 120), nullif(left(trim(p_trigger_reference), 240), ''),
    coalesce(p_evidence_references, '[]'::jsonb), coalesce(p_source_systems, array['mise']::text[]),
    p_action_id, p_recommendation_id, p_autonomy_level, p_confidence,
    p_status, coalesce(p_requires_attention, false), p_attention_deadline,
    nullif(left(trim(p_related_entity_type), 80), ''),
    nullif(left(trim(p_related_entity_id), 240), ''),
    nullif(left(trim(p_sequence_id), 240), ''),
    coalesce(p_correlation_id, gen_random_uuid()), p_causation_id,
    left(trim(p_idempotency_key), 240), coalesce(p_metadata, '{}'::jsonb),
    nullif(left(trim(p_error_code), 80), ''),
    nullif(left(trim(p_error_message), 1000), '')
  )
  on conflict (restaurant_id, idempotency_key) do nothing
  returning * into event_row;

  if event_row.id is null then
    select * into event_row
    from public.activity_events
    where restaurant_id = p_restaurant_id
      and idempotency_key = left(trim(p_idempotency_key), 240);
  end if;
  return event_row;
end;
$$;

create or replace function public.service_append_activity_event(
  p_restaurant_id uuid,
  p_event_type text,
  p_category text,
  p_title text,
  p_summary text,
  p_occurred_at timestamptz,
  p_source text,
  p_actor_type text,
  p_actor_user_id uuid,
  p_trigger_type text,
  p_trigger_reference text,
  p_evidence_references jsonb,
  p_source_systems text[],
  p_action_id uuid,
  p_recommendation_id uuid,
  p_autonomy_level smallint,
  p_confidence numeric,
  p_status text,
  p_requires_attention boolean,
  p_attention_deadline timestamptz,
  p_related_entity_type text,
  p_related_entity_id text,
  p_sequence_id text,
  p_correlation_id uuid,
  p_causation_id uuid,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb,
  p_error_code text default null,
  p_error_message text default null,
  p_location_id uuid default null
)
returns public.activity_events
language sql
security invoker
set search_path = ''
as $$
  select private.append_activity_event(
    p_restaurant_id, p_event_type, p_category, p_title, p_summary,
    p_occurred_at, p_source, p_actor_type, p_actor_user_id,
    p_trigger_type, p_trigger_reference, p_evidence_references,
    p_source_systems, p_action_id, p_recommendation_id,
    p_autonomy_level, p_confidence, p_status, p_requires_attention,
    p_attention_deadline, p_related_entity_type, p_related_entity_id,
    p_sequence_id, p_correlation_id, p_causation_id, p_idempotency_key,
    p_metadata, p_error_code, p_error_message, p_location_id
  );
$$;

create or replace function private.capture_operational_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  action_row public.mise_actions;
  event_type text;
  event_category text;
  event_title text;
  event_summary text;
  event_status text;
  event_attention boolean := false;
  event_autonomy smallint := 1;
  event_actor_type text := case when auth.uid() is null then 'system' else 'user' end;
  event_actor uuid := auth.uid();
  event_key text;
  event_sequence text;
  event_trigger text;
  event_related_type text;
  event_related_id text;
  event_recommendation_id uuid;
  event_action_id uuid;
  event_metadata jsonb := '{}'::jsonb;
  event_evidence jsonb := '[]'::jsonb;
  event_sources text[] := array['mise']::text[];
  event_occurred_at timestamptz := now();
  tenant_id uuid;
begin
  tenant_id := new.restaurant_id;

  if tg_table_name = 'purchase_recommendations' then
    if tg_op = 'INSERT' then
      insert into public.operational_issues (
        restaurant_id, category, severity, title, explanation, evidence,
        first_detected_at, last_detected_at, status, related_entity_type,
        related_entity_id, dedupe_key
      ) values (
        new.restaurant_id, 'inventory',
        case new.urgency when 'high' then 'critical' when 'medium' then 'warning' else 'watch' end,
        left(format('%s inventory risk', new.item_name), 160),
        left(new.reason, 2000),
        jsonb_build_array(jsonb_build_object(
          'type', 'purchase_recommendation', 'id', new.id,
          'inventoryItemId', new.inventory_item_id,
          'recommendedQuantity', new.recommended_quantity,
          'unit', new.unit,
          'observedAt', new.created_at
        )),
        new.created_at, new.created_at,
        case when new.status = 'pending' then 'action_prepared' else 'open' end,
        'inventory_item', new.inventory_item_id::text,
        format('inventory-risk:%s', new.inventory_item_id)
      )
      on conflict (restaurant_id, dedupe_key) do update
      set severity = excluded.severity,
        title = excluded.title,
        explanation = excluded.explanation,
        evidence = excluded.evidence,
        last_detected_at = excluded.last_detected_at,
        status = excluded.status,
        updated_at = now();

      event_type := case when new.status = 'pending' then 'approval_required' else 'recommendation_created' end;
      event_category := case when new.status = 'pending' then 'approvals' else 'orders' end;
      event_title := case when new.status = 'pending' then 'Approval required' else 'Recommendation created' end;
      event_summary := case when new.status = 'pending'
        then format('A %s %s %s reorder is ready for approval.', new.recommended_quantity, new.unit, new.item_name)
        else format('%s recommendation recorded.', new.item_name)
      end;
      event_status := case when new.status = 'pending' then 'waiting_for_approval' else 'prepared' end;
      event_attention := new.status = 'pending';
      event_autonomy := 3;
      event_key := format('purchase_recommendation:%s:%s', new.id, new.status);
      event_sequence := format('inventory-order:%s', new.inventory_item_id);
      event_trigger := 'inventory_depletion';
      event_related_type := 'purchase_recommendation';
      event_related_id := new.id::text;
      event_recommendation_id := new.id;
      event_occurred_at := new.created_at;
      event_evidence := jsonb_build_array(jsonb_build_object(
        'type', 'purchase_recommendation', 'id', new.id,
        'summary', new.reason, 'observedAt', new.created_at
      ));
      event_metadata := jsonb_build_object(
        'inventoryItemId', new.inventory_item_id,
        'itemName', new.item_name,
        'supplierName', new.supplier_name,
        'recommendedQuantity', new.recommended_quantity,
        'unit', new.unit,
        'urgency', new.urgency
      );
      event_sources := array['mise', 'inventory', 'pos']::text[];
    elsif old.status is distinct from new.status then
      update public.operational_issues
      set status = case new.status
          when 'ordered' then 'resolved'
          when 'dismissed' then 'dismissed'
          when 'approved' then 'action_prepared'
          else status
        end,
        last_detected_at = greatest(last_detected_at, now()),
        updated_at = now()
      where restaurant_id = new.restaurant_id
        and dedupe_key = format('inventory-risk:%s', new.inventory_item_id);

      -- The supplier-order transition emits the single operator-facing send
      -- event. Avoid one duplicate feed row per recommendation on grouped
      -- supplier orders.
      if new.status = 'ordered' then return new; end if;
      event_type := case new.status
        when 'approved' then 'order_approved'
        when 'dismissed' then 'recommendation_dismissed'
        when 'ordered' then 'order_sent'
        else 'recommendation_created'
      end;
      event_category := case when new.status = 'approved' then 'approvals' else 'orders' end;
      event_title := case new.status
        when 'approved' then 'Order recommendation approved'
        when 'dismissed' then 'Recommendation dismissed'
        when 'ordered' then 'Order sent'
        else 'Recommendation updated'
      end;
      event_summary := format('%s is now %s.', new.item_name, replace(new.status, '_', ' '));
      event_status := case new.status
        when 'approved' then 'confirmed'
        when 'dismissed' then 'cancelled'
        when 'ordered' then 'sent'
        else 'prepared'
      end;
      event_autonomy := 3;
      event_key := format('purchase_recommendation:%s:%s', new.id, new.status);
      event_sequence := format('inventory-order:%s', new.inventory_item_id);
      event_trigger := 'recommendation_status_changed';
      event_related_type := 'purchase_recommendation';
      event_related_id := new.id::text;
      event_recommendation_id := new.id;
      event_metadata := jsonb_build_object(
        'inventoryItemId', new.inventory_item_id,
        'itemName', new.item_name,
        'supplierName', new.supplier_name,
        'previousStatus', old.status,
        'status', new.status,
        'supplierOrderId', new.supplier_order_id
      );
    else
      return new;
    end if;

  elsif tg_table_name = 'supplier_orders' then
    if tg_op = 'INSERT' then
      insert into public.mise_actions (
        restaurant_id, recommendation_id, action_type, execution_mode,
        status, autonomy_level, trigger_type, trigger_reference,
        reason, evidence, requested_by, idempotency_key,
        expected_impact, created_at, updated_at
      ) values (
        new.restaurant_id, null, 'send_supplier_order', 'prepare',
        'waiting_for_approval', 3, 'supplier_order_drafted', new.id::text,
        format('Send the prepared %s supplier order after owner or manager approval.', new.supplier_name),
        jsonb_build_array(jsonb_build_object('type', 'supplier_order', 'id', new.id)),
        auth.uid(), format('send_supplier_order:%s', new.id),
        jsonb_build_object(
          'orderId', new.id,
          'supplierName', new.supplier_name,
          'deliveryDate', new.delivery_date
        ),
        new.created_at, new.created_at
      )
      on conflict (restaurant_id, idempotency_key) do update
      set updated_at = excluded.updated_at
      returning * into action_row;

      event_type := 'order_prepared';
      event_category := 'approvals';
      event_title := 'Supplier order prepared';
      event_summary := format('%s order is prepared and waiting for approval.', new.supplier_name);
      event_status := 'waiting_for_approval';
      event_attention := true;
      event_autonomy := 3;
      event_key := format('supplier_order:%s:draft', new.id);
      event_sequence := format('supplier-order:%s', new.id);
      event_trigger := 'supplier_order_drafted';
      event_related_type := 'supplier_order';
      event_related_id := new.id::text;
      event_action_id := action_row.id;
      event_occurred_at := new.created_at;
      event_metadata := jsonb_build_object(
        'supplierName', new.supplier_name,
        'deliveryDate', new.delivery_date
      );
      event_evidence := jsonb_build_array(jsonb_build_object(
        'type', 'supplier_order', 'id', new.id,
        'summary', 'Prepared from approved purchase recommendations.'
      ));
      event_sources := array['mise', 'inventory', 'orders']::text[];
    elsif old.status is distinct from new.status then
      -- record_supplier_delivery emits the richer consolidated delivery event
      -- after inventory projection and outcome persistence complete.
      if new.status = 'completed' then return new; end if;
      select * into action_row
      from public.mise_actions action
      where action.restaurant_id = new.restaurant_id
        and action.idempotency_key = format('send_supplier_order:%s', new.id)
      for update;

      if new.status = 'sent' and action_row.id is not null then
        update public.mise_actions
        set status = 'executed',
          approved_by = coalesce(approved_by, new.sent_by_user_id),
          executed_at = coalesce(new.sent_at, now()),
          result = jsonb_build_object(
            'supplierOrderId', new.id,
            'provider', new.email_provider,
            'providerMessageId', new.provider_message_id,
            'sentAt', new.sent_at
          ),
          error_code = null,
          error_message = null,
          updated_at = now()
        where id = action_row.id and restaurant_id = new.restaurant_id
        returning * into action_row;
      end if;

      event_type := case when new.status = 'sent' then 'order_sent' else 'delivery_logged' end;
      event_category := 'orders';
      event_title := case when new.status = 'sent' then 'Supplier order sent' else 'Supplier order completed' end;
      event_summary := case when new.status = 'sent'
        then format('%s accepted the order message for delivery.', new.supplier_name)
        else format('%s order is recorded as received.', new.supplier_name)
      end;
      event_status := case when new.status = 'sent' then 'sent' else 'completed' end;
      event_autonomy := case when new.status = 'sent' then 3 else 5 end;
      event_key := format('supplier_order:%s:%s', new.id, new.status);
      event_sequence := format('supplier-order:%s', new.id);
      event_trigger := 'supplier_order_status_changed';
      event_related_type := 'supplier_order';
      event_related_id := new.id::text;
      event_action_id := action_row.id;
      event_actor := coalesce(new.sent_by_user_id, auth.uid());
      event_metadata := jsonb_build_object(
        'supplierName', new.supplier_name,
        'previousStatus', old.status,
        'status', new.status,
        'provider', new.email_provider,
        'sentAt', new.sent_at
      );
      event_sources := array['mise', 'orders', coalesce(new.email_provider, 'manual')]::text[];
    else
      return new;
    end if;

  elsif tg_table_name = 'inventory_events' then
    -- Supplier receipts are summarized by the delivery aggregate. The ledger
    -- remains authoritative without flooding the activity feed per line item.
    if new.event_type = 'receipt' and new.source = 'supplier_delivery' then
      return new;
    end if;
    event_type := case
      when new.event_type = 'count' then 'inventory_count_recorded'
      when new.event_type = 'receipt' then 'delivery_logged'
      when new.event_type = 'stockout' then 'inventory_risk_detected'
      else 'forecast_updated'
    end;
    event_category := 'inventory';
    event_title := case
      when new.event_type = 'count' then 'Inventory count recorded'
      when new.event_type = 'receipt' then 'Delivery quantity recorded'
      when new.event_type = 'stockout' then 'Stockout recorded'
      else 'Inventory quantity updated'
    end;
    event_summary := format('%s %s inventory event recorded.', new.quantity, new.canonical_unit);
    event_status := 'completed';
    event_attention := new.event_type = 'stockout';
    event_autonomy := case when new.event_type in ('usage', 'adjustment') then 4 else 1 end;
    event_key := format('inventory_event:%s', new.id);
    event_sequence := coalesce(new.metadata->>'sequenceId', format('inventory-item:%s', new.inventory_item_id));
    event_trigger := new.event_type;
    event_related_type := 'inventory_item';
    event_related_id := new.inventory_item_id::text;
    event_actor_type := case when new.source like 'mise%' then 'mise' else 'user' end;
    event_actor := new.actor_user_id;
    event_occurred_at := new.effective_at;
    event_metadata := jsonb_build_object(
      'inventoryItemId', new.inventory_item_id,
      'eventType', new.event_type,
      'quantity', new.quantity,
      'canonicalUnit', new.canonical_unit,
      'sourceReference', new.source_reference
    );
    event_evidence := jsonb_build_array(jsonb_build_object(
      'type', 'inventory_event', 'id', new.id,
      'summary', format('%s %s via %s', new.quantity, new.canonical_unit, new.source),
      'observedAt', new.effective_at
    ));
    event_sources := array['mise', 'inventory', new.source]::text[];

  elsif tg_table_name = 'action_outcomes' then
    select * into action_row
    from public.mise_actions action
    where action.restaurant_id = new.restaurant_id
      and action.id = new.action_id;

    event_type := 'recommendation_outcome_measured';
    event_category := case
      when action_row.action_type in ('prepare_supplier_order_draft', 'send_supplier_order')
        then 'orders'
      else 'system'
    end;
    event_title := 'Action outcome measured';
    event_summary := coalesce(
      nullif(left(trim(new.lesson), 1000), ''),
      'Mise compared the expected and actual result of an operational action.'
    );
    event_status := 'completed';
    event_autonomy := 5;
    event_key := format('action_outcome:%s', new.id);
    event_sequence := format('mise-action:%s', new.action_id);
    event_trigger := 'action_outcome';
    event_related_type := 'mise_action';
    event_related_id := new.action_id::text;
    event_action_id := new.action_id;
    event_actor_type := 'system';
    event_actor := null;
    event_occurred_at := new.measured_at;
    event_metadata := jsonb_build_object(
      'outcomeId', new.id,
      'actionType', action_row.action_type,
      'expectedResult', new.expected_result,
      'actualResult', new.actual_result,
      'variance', new.variance
    );
    event_evidence := jsonb_build_array(jsonb_build_object(
      'type', 'action_outcome', 'id', new.id,
      'summary', coalesce(new.lesson, 'Expected and actual results were compared.'),
      'observedAt', new.measured_at
    ));
    event_sources := array['mise', 'outcomes']::text[];

  elsif tg_table_name = 'sales_imports' then
    if tg_op <> 'UPDATE' or old.status is not distinct from new.status
      or new.status not in ('completed', 'failed')
    then
      return new;
    end if;
    event_type := case when new.status = 'completed' then 'pos_sync_completed' else 'automation_failed' end;
    event_category := case when new.status = 'completed' then 'sales' else 'integrations' end;
    event_title := case when new.status = 'completed' then 'POS sync completed' else 'POS sync failed' end;
    event_summary := case when new.status = 'completed'
      then format('%s sales records were processed.', new.records_processed)
      else 'The POS sync did not complete. Forecasts may be incomplete.'
    end;
    event_status := case when new.status = 'completed' then 'completed' else 'failed' end;
    event_attention := new.status = 'failed';
    event_autonomy := 4;
    event_key := format('sales_import:%s:%s', new.id, new.status);
    event_sequence := format('pos-sync:%s', new.id);
    event_trigger := 'pos_sync';
    event_related_type := 'pos_import';
    event_related_id := new.id::text;
    event_metadata := jsonb_build_object(
      'status', new.status,
      'recordsProcessed', new.records_processed,
      'importType', new.import_type
    );
    event_sources := array['mise', 'pos']::text[];
  else
    return new;
  end if;

  perform private.append_activity_event(
    tenant_id, event_type, event_category, event_title, event_summary,
    event_occurred_at, 'mise', event_actor_type, event_actor,
    event_trigger, event_related_id, event_evidence, event_sources,
    event_action_id, event_recommendation_id, event_autonomy, null,
    event_status, event_attention, null, event_related_type,
    event_related_id, event_sequence, null, null, event_key,
    event_metadata, null, null, null
  );
  return new;
end;
$$;

drop trigger if exists capture_purchase_recommendation_activity on public.purchase_recommendations;
create trigger capture_purchase_recommendation_activity
after insert or update on public.purchase_recommendations
for each row execute function private.capture_operational_activity();

drop trigger if exists capture_supplier_order_activity on public.supplier_orders;
create trigger capture_supplier_order_activity
after insert or update on public.supplier_orders
for each row execute function private.capture_operational_activity();

drop trigger if exists capture_inventory_event_activity on public.inventory_events;
create trigger capture_inventory_event_activity
after insert on public.inventory_events
for each row execute function private.capture_operational_activity();

drop trigger if exists capture_action_outcome_activity on public.action_outcomes;
create trigger capture_action_outcome_activity
after insert on public.action_outcomes
for each row execute function private.capture_operational_activity();

drop trigger if exists capture_sales_import_activity on public.sales_imports;
create trigger capture_sales_import_activity
after update on public.sales_imports
for each row execute function private.capture_operational_activity();

create or replace function public.decide_mise_action(
  p_restaurant_id uuid,
  p_action_id uuid,
  p_decision text
)
returns public.mise_actions
language plpgsql
security definer
set search_path = ''
as $$
declare
  action_row public.mise_actions;
  next_status text;
begin
  if auth.uid() is null
    or not private.has_restaurant_role(p_restaurant_id, array['owner', 'admin', 'manager'])
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Unsupported action decision' using errcode = '22023';
  end if;

  select * into action_row
  from public.mise_actions
  where restaurant_id = p_restaurant_id and id = p_action_id
  for update;
  if not found then raise exception 'Action not found' using errcode = 'P0002'; end if;

  if action_row.status = p_decision then return action_row; end if;
  if p_decision = 'approved'
    and action_row.status not in ('prepared', 'waiting_for_approval', 'failed')
  then
    raise exception 'Action cannot be approved in its current state' using errcode = '22023';
  end if;
  if p_decision = 'rejected'
    and action_row.status not in ('prepared', 'waiting_for_approval', 'approved', 'failed')
  then
    raise exception 'Action cannot be rejected in its current state' using errcode = '22023';
  end if;
  next_status := p_decision;

  update public.mise_actions
  set status = next_status,
    approved_by = auth.uid(),
    error_code = case when p_decision = 'approved' then null else error_code end,
    error_message = case when p_decision = 'approved' then null else error_message end,
    updated_at = now()
  where restaurant_id = p_restaurant_id and id = p_action_id
  returning * into action_row;

  perform private.append_activity_event(
    p_restaurant_id,
    case when p_decision = 'approved' then 'order_approved' else 'recommendation_dismissed' end,
    'approvals',
    case when p_decision = 'approved' then 'Action approved' else 'Action rejected' end,
    case when p_decision = 'approved'
      then 'The prepared action was approved.'
      else 'The prepared action was rejected and will not execute.'
    end,
    now(), 'mise', 'user', auth.uid(), 'action_decision', p_action_id::text,
    jsonb_build_array(jsonb_build_object('type', 'mise_action', 'id', p_action_id)),
    array['mise']::text[], p_action_id, action_row.recommendation_id,
    action_row.autonomy_level, action_row.confidence,
    case when p_decision = 'approved' then 'confirmed' else 'cancelled' end,
    false, null, 'mise_action', p_action_id::text,
    format('mise-action:%s', p_action_id), action_row.correlation_id, null,
    format('mise_action:%s:%s', p_action_id, p_decision),
    jsonb_build_object('decision', p_decision, 'actionType', action_row.action_type),
    null, null, action_row.location_id
  );
  return action_row;
end;
$$;

create or replace function private.service_record_mise_action_failure(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_supplier_order_id uuid,
  p_failure_status text,
  p_error_code text,
  p_error_message text
)
returns public.mise_actions
language plpgsql
security definer
set search_path = ''
as $$
declare
  action_row public.mise_actions;
  public_status text;
begin
  if p_failure_status not in ('failed', 'unverified')
    or p_error_code is null
    or p_error_code !~ '^[a-z0-9_]{1,80}$'
    or nullif(trim(p_error_message), '') is null
  then
    raise exception 'Action failure evidence is invalid' using errcode = '22023';
  end if;
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Manager access required' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.system_operational_controls controls
    where controls.singleton
      and controls.operational_mode <> 'normal'
  ) then
    raise exception 'Action failure recording is paused' using errcode = '55000';
  end if;

  select * into action_row
  from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.action_type = 'send_supplier_order'
    and action.idempotency_key = format('send_supplier_order:%s', p_supplier_order_id)
  for update;
  if not found then
    raise exception 'Supplier send action not found' using errcode = 'P0002';
  end if;
  if action_row.status = 'executed' then return action_row; end if;
  if action_row.status in ('failed', 'unverified') then return action_row; end if;
  if action_row.status in ('rejected', 'cancelled', 'reversed') then
    raise exception 'Supplier send action is not executable' using errcode = '22023';
  end if;

  update public.mise_actions
  set status = p_failure_status,
    error_code = p_error_code,
    error_message = left(trim(p_error_message), 1000),
    updated_at = now()
  where restaurant_id = p_restaurant_id and id = action_row.id
  returning * into action_row;

  public_status := case when p_failure_status = 'unverified'
    then 'could_not_verify' else 'failed' end;
  perform private.append_activity_event(
    p_restaurant_id, 'automation_failed', 'orders',
    case when p_failure_status = 'unverified'
      then 'Supplier order send could not be verified'
      else 'Supplier order send failed'
    end,
    left(trim(p_error_message), 1000),
    now(), 'mise', 'integration', p_actor_user_id,
    'supplier_email_delivery', p_supplier_order_id::text,
    jsonb_build_array(
      jsonb_build_object('type', 'supplier_order', 'id', p_supplier_order_id),
      jsonb_build_object('type', 'mise_action', 'id', action_row.id)
    ),
    array['mise', 'orders', 'gmail']::text[], action_row.id,
    action_row.recommendation_id, action_row.autonomy_level,
    action_row.confidence, public_status, true, null,
    'supplier_order', p_supplier_order_id::text,
    format('supplier-order:%s', p_supplier_order_id),
    action_row.correlation_id, null,
    format('supplier_order:%s:%s:%s', p_supplier_order_id, p_failure_status, p_error_code),
    jsonb_build_object(
      'supplierOrderId', p_supplier_order_id,
      'actionType', action_row.action_type,
      'failureStatus', p_failure_status
    ),
    p_error_code, left(trim(p_error_message), 1000), action_row.location_id
  );
  return action_row;
end;
$$;

create or replace function public.service_record_mise_action_failure(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_supplier_order_id uuid,
  p_failure_status text,
  p_error_code text,
  p_error_message text
)
returns public.mise_actions
language sql
security invoker
set search_path = ''
as $$
  select private.service_record_mise_action_failure(
    p_actor_user_id, p_restaurant_id, p_supplier_order_id,
    p_failure_status, p_error_code, p_error_message
  );
$$;

create or replace function public.update_restaurant_memory(
  p_restaurant_id uuid,
  p_memory_id uuid,
  p_decision text,
  p_correction text default null
)
returns public.restaurant_memories
language plpgsql
security definer
set search_path = ''
as $$
declare
  memory_row public.restaurant_memories;
  next_status text;
begin
  if auth.uid() is null
    or not private.has_restaurant_role(p_restaurant_id, array['owner', 'admin', 'manager'])
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;
  if p_decision not in ('confirmed', 'corrected', 'dismissed', 'forgotten', 'disabled') then
    raise exception 'Unsupported memory decision' using errcode = '22023';
  end if;
  if p_decision = 'corrected' and nullif(trim(p_correction), '') is null then
    raise exception 'A correction is required' using errcode = '22023';
  end if;

  select * into memory_row
  from public.restaurant_memories
  where restaurant_id = p_restaurant_id and id = p_memory_id
  for update;
  if not found then raise exception 'Memory not found' using errcode = 'P0002'; end if;

  next_status := p_decision;
  update public.restaurant_memories
  set status = next_status,
    correction = case when p_decision = 'corrected' then left(trim(p_correction), 1000) else correction end,
    affects_recommendations = case when p_decision in ('dismissed', 'forgotten', 'disabled') then false else affects_recommendations end,
    affects_automation = case when p_decision in ('dismissed', 'forgotten', 'disabled') then false else affects_automation end,
    corrected_by = auth.uid(), corrected_at = now(), last_updated_at = now()
  where restaurant_id = p_restaurant_id and id = p_memory_id
  returning * into memory_row;

  perform private.append_activity_event(
    p_restaurant_id, 'restaurant_memory_updated', 'memory',
    'Restaurant memory updated',
    case p_decision
      when 'confirmed' then 'An owner or manager confirmed this learned pattern.'
      when 'corrected' then 'An owner or manager corrected this learned pattern.'
      when 'dismissed' then 'This learned pattern was dismissed.'
      when 'forgotten' then 'This learned pattern was forgotten and no longer affects Mise.'
      else 'This learned pattern was disabled.'
    end,
    now(), 'mise', 'user', auth.uid(), 'memory_decision', p_memory_id::text,
    jsonb_build_array(jsonb_build_object('type', 'restaurant_memory', 'id', p_memory_id)),
    array['mise', 'memory']::text[], null, null, 5::smallint, memory_row.confidence,
    'completed', false, null, 'memory', p_memory_id::text,
    format('memory:%s', p_memory_id), null, null,
    format('restaurant_memory:%s:%s:%s', p_memory_id, p_decision, extract(epoch from now())::bigint),
    jsonb_build_object('decision', p_decision, 'memoryType', memory_row.memory_type),
    null, null, memory_row.location_id
  );
  return memory_row;
end;
$$;

create or replace function public.upsert_restaurant_autonomy_rule(
  p_restaurant_id uuid,
  p_action_type text,
  p_operational_category text,
  p_maximum_autonomy_level smallint,
  p_requires_approval boolean,
  p_enabled boolean,
  p_spend_limit_cents bigint default null,
  p_supplier_name text default null,
  p_communication_type text default null,
  p_location_id uuid default null,
  p_allowed_start_time time default null,
  p_allowed_end_time time default null
)
returns public.restaurant_autonomy_rules
language plpgsql
security definer
set search_path = ''
as $$
declare
  rule_row public.restaurant_autonomy_rules;
begin
  if auth.uid() is null
    or not private.has_restaurant_role(p_restaurant_id, array['owner', 'admin'])
  then
    raise exception 'Owner or admin access required' using errcode = '42501';
  end if;
  if nullif(trim(p_action_type), '') is null
    or p_operational_category not in (
      'inventory', 'orders', 'sales', 'team', 'waste', 'tasks', 'integrations', 'settings'
    )
    or p_maximum_autonomy_level not between 1 and 5
    or p_spend_limit_cents is not null and p_spend_limit_cents < 0
  then
    raise exception 'Invalid autonomy rule' using errcode = '22023';
  end if;

  insert into public.restaurant_autonomy_rules (
    restaurant_id, location_id, action_type, operational_category,
    maximum_autonomy_level, requires_approval, enabled, spend_limit_cents,
    supplier_name, communication_type, allowed_start_time,
    allowed_end_time, created_by, updated_by
  ) values (
    p_restaurant_id, p_location_id, left(trim(p_action_type), 120),
    p_operational_category, p_maximum_autonomy_level,
    coalesce(p_requires_approval, true), coalesce(p_enabled, false),
    p_spend_limit_cents, nullif(left(trim(p_supplier_name), 160), ''),
    nullif(left(trim(p_communication_type), 80), ''),
    p_allowed_start_time, p_allowed_end_time, auth.uid(), auth.uid()
  )
  on conflict on constraint restaurant_autonomy_rules_scope_key do update
  set operational_category = excluded.operational_category,
    maximum_autonomy_level = excluded.maximum_autonomy_level,
    requires_approval = excluded.requires_approval,
    enabled = excluded.enabled,
    spend_limit_cents = excluded.spend_limit_cents,
    allowed_start_time = excluded.allowed_start_time,
    allowed_end_time = excluded.allowed_end_time,
    updated_by = auth.uid(), updated_at = now()
  returning * into rule_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, auth.uid(), 'autonomy_rule_updated',
    'restaurant_autonomy_rules', rule_row.id,
    jsonb_build_object(
      'action_type', rule_row.action_type,
      'maximum_autonomy_level', rule_row.maximum_autonomy_level,
      'requires_approval', rule_row.requires_approval,
      'enabled', rule_row.enabled,
      'has_spend_limit', rule_row.spend_limit_cents is not null
    )
  );
  return rule_row;
end;
$$;

create or replace function public.record_supplier_delivery(
  p_restaurant_id uuid,
  p_supplier_order_id uuid,
  p_client_delivery_id text,
  p_received_at timestamptz,
  p_lines jsonb,
  p_invoice_total numeric default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.supplier_orders;
  delivery_row public.supplier_deliveries;
  delivery_line jsonb;
  item_row public.inventory_items;
  event_row public.inventory_events;
  action_row public.mise_actions;
  outcome_row public.action_outcomes;
  memory_row public.restaurant_memories;
  memory_evidence jsonb;
  memory_statement text;
  memory_sample_count integer;
  memory_matched_count integer;
  normalized_status text := 'received';
  ordered_quantity numeric;
  received_quantity numeric;
  damaged_quantity numeric;
  missing_quantity numeric;
  line_canonical_unit text;
  inventory_item_id uuid;
  substitution_item_id uuid;
  unit_price numeric;
  discrepancy_reason text;
  line_number integer := 0;
  line_count integer;
  has_discrepancy boolean := false;
  has_partial boolean := false;
begin
  if auth.uid() is null
    or not private.has_restaurant_role(p_restaurant_id, array['owner', 'admin', 'manager'])
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;
  if nullif(trim(p_client_delivery_id), '') is null
    or p_received_at is null
    or jsonb_typeof(p_lines) <> 'array'
    or jsonb_array_length(p_lines) not between 1 and 200
    or pg_column_size(p_lines) > 262144
    or p_invoice_total is not null and (p_invoice_total < 0 or p_invoice_total > 10000000)
    or p_notes is not null and length(p_notes) > 2000
  then
    raise exception 'Delivery evidence is incomplete' using errcode = '22023';
  end if;

  select * into order_row
  from public.supplier_orders
  where restaurant_id = p_restaurant_id and id = p_supplier_order_id
  for update;
  if not found then raise exception 'Supplier order not found' using errcode = 'P0002'; end if;
  if order_row.status not in ('sent', 'completed') then
    raise exception 'Only sent orders can be received' using errcode = '22023';
  end if;

  select * into delivery_row
  from public.supplier_deliveries
  where restaurant_id = p_restaurant_id
    and client_delivery_id = left(trim(p_client_delivery_id), 200)
  for update;
  if found then
    if delivery_row.supplier_order_id <> p_supplier_order_id then
      raise exception 'Delivery id belongs to another order' using errcode = '23505';
    end if;
    return jsonb_build_object('outcome', 'already_applied', 'delivery', to_jsonb(delivery_row));
  end if;

  insert into public.supplier_deliveries (
    restaurant_id, supplier_order_id, status, received_at, verified_by,
    invoice_total, notes, client_delivery_id, idempotency_key
  ) values (
    p_restaurant_id, p_supplier_order_id, 'unverified', p_received_at,
    auth.uid(), p_invoice_total, nullif(trim(p_notes), ''),
    left(trim(p_client_delivery_id), 200),
    format('supplier_delivery:%s', left(trim(p_client_delivery_id), 200))
  ) returning * into delivery_row;

  line_count := jsonb_array_length(p_lines);
  for delivery_line in select value from jsonb_array_elements(p_lines)
  loop
    line_number := line_number + 1;
    begin
      inventory_item_id := (delivery_line->>'inventoryItemId')::uuid;
      substitution_item_id := nullif(delivery_line->>'substitutionInventoryItemId', '')::uuid;
      ordered_quantity := nullif(delivery_line->>'orderedQuantity', '')::numeric;
      received_quantity := (delivery_line->>'receivedQuantity')::numeric;
      damaged_quantity := coalesce(nullif(delivery_line->>'damagedQuantity', '')::numeric, 0);
      missing_quantity := coalesce(nullif(delivery_line->>'missingQuantity', '')::numeric, 0);
      line_canonical_unit := delivery_line->>'canonicalUnit';
      unit_price := nullif(delivery_line->>'unitPrice', '')::numeric;
      discrepancy_reason := nullif(left(trim(delivery_line->>'discrepancyReason'), 500), '');
    exception
      when others then
        raise exception 'Delivery line % is invalid', line_number using errcode = '22023';
    end;

    if inventory_item_id is null
      or received_quantity is null or received_quantity < 0 or received_quantity > 1000000
      or ordered_quantity is not null and (ordered_quantity < 0 or ordered_quantity > 1000000)
      or damaged_quantity < 0 or damaged_quantity > received_quantity
      or missing_quantity < 0 or missing_quantity > 1000000
      or line_canonical_unit not in ('g', 'ml', 'each')
      or unit_price is not null and (unit_price < 0 or unit_price > 1000000)
    then
      raise exception 'Delivery line % is outside operational bounds', line_number using errcode = '22023';
    end if;

    select * into item_row
    from public.inventory_items
    where restaurant_id = p_restaurant_id and id = inventory_item_id;
    if not found then raise exception 'Delivery line item not found' using errcode = 'P0002'; end if;
    if item_row.canonical_unit_verification_status <> 'verified'
      or item_row.canonical_unit <> line_canonical_unit
    then
      raise exception 'Delivery line canonical unit is not verified' using errcode = '22023';
    end if;
    if substitution_item_id is not null and not exists (
      select 1 from public.inventory_items substitution
      where substitution.restaurant_id = p_restaurant_id
        and substitution.id = substitution_item_id
        and substitution.canonical_unit_verification_status = 'verified'
        and substitution.canonical_unit = line_canonical_unit
    ) then
      raise exception 'Delivery substitution is not verified' using errcode = '22023';
    end if;

    has_discrepancy := has_discrepancy
      or damaged_quantity > 0
      or missing_quantity > 0
      or substitution_item_id is not null
      or discrepancy_reason is not null;
    has_partial := has_partial
      or (ordered_quantity is not null and received_quantity + missing_quantity < ordered_quantity);

    if received_quantity - damaged_quantity > 0 then
      select * into event_row
      from public.record_inventory_event(
        p_restaurant_id, coalesce(substitution_item_id, inventory_item_id), 'receipt',
        received_quantity - damaged_quantity, line_canonical_unit,
        p_received_at, 'supplier_delivery',
        format('%s:%s', left(trim(p_client_delivery_id), 200), coalesce(substitution_item_id, inventory_item_id)),
        format('supplier_delivery:%s:%s', left(trim(p_client_delivery_id), 160), coalesce(substitution_item_id, inventory_item_id)),
        delivery_row.id::text, 'supplier_delivery', null,
        jsonb_build_object(
          'supplierOrderId', p_supplier_order_id,
          'deliveryId', delivery_row.id,
          'supplierName', order_row.supplier_name,
          'sequenceId', format('supplier-order:%s', p_supplier_order_id),
          'lineNumber', line_number
        )
      );
    else
      event_row := null;
    end if;

    insert into public.supplier_delivery_items (
      restaurant_id, delivery_id, inventory_item_id, ordered_quantity,
      received_quantity, damaged_quantity, missing_quantity, canonical_unit,
      substitution_inventory_item_id, unit_price, discrepancy_reason,
      inventory_event_id
    ) values (
      p_restaurant_id, delivery_row.id, inventory_item_id, ordered_quantity,
      received_quantity, damaged_quantity, missing_quantity, line_canonical_unit,
      substitution_item_id, unit_price, discrepancy_reason, event_row.id
    );
  end loop;

  normalized_status := case
    when has_discrepancy then 'discrepancy'
    when has_partial then 'partially_received'
    else 'received'
  end;
  update public.supplier_deliveries
  set status = normalized_status, updated_at = now()
  where id = delivery_row.id and restaurant_id = p_restaurant_id
  returning * into delivery_row;

  if normalized_status = 'received' then
    update public.supplier_orders
    set status = 'completed'
    where restaurant_id = p_restaurant_id
      and id = p_supplier_order_id
      and status = 'sent';
  end if;

  select * into action_row
  from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.idempotency_key = format('send_supplier_order:%s', p_supplier_order_id);

  if action_row.id is not null then
    insert into public.action_outcomes (
      restaurant_id, action_id, expected_result, actual_result, variance,
      measured_at, lesson, idempotency_key
    ) values (
      p_restaurant_id, action_row.id,
      jsonb_build_object('deliveryStatus', 'received'),
      jsonb_build_object(
        'deliveryStatus', normalized_status,
        'deliveryId', delivery_row.id,
        'lineCount', line_count
      ),
      jsonb_build_object(
        'deliveryStatusMatched', normalized_status = 'received',
        'hasDiscrepancy', has_discrepancy,
        'hasPartialReceipt', has_partial
      ),
      now(),
      case when normalized_status = 'received'
        then 'The supplier order was received as expected.'
        else 'Review this supplier outcome before using it to adjust supplier reliability.'
      end,
      format('supplier_delivery_outcome:%s', delivery_row.id)
    )
    on conflict (restaurant_id, idempotency_key) do nothing
    returning * into outcome_row;
  end if;

  select * into memory_row
  from public.restaurant_memories memory
  where memory.restaurant_id = p_restaurant_id
    and memory.dedupe_key = format(
      'supplier-delivery-outcome:%s', lower(trim(order_row.supplier_name))
    )
  for update;

  if found and memory_row.status in ('dismissed', 'forgotten', 'disabled') then
    -- Respect the owner's explicit decision. A later delivery must not silently
    -- recreate or re-enable a memory they removed from recommendations.
    memory_row := null;
  else
    memory_evidence := case when memory_row.id is null
      then '[]'::jsonb else memory_row.evidence end;
    memory_evidence := memory_evidence || jsonb_build_array(jsonb_build_object(
      'type', 'supplier_delivery',
      'id', delivery_row.id,
      'supplierOrderId', p_supplier_order_id,
      'status', normalized_status,
      'matched', normalized_status = 'received',
      'summary', case when normalized_status = 'received'
        then format('%s delivery matched the recorded order.', order_row.supplier_name)
        else format('%s delivery was recorded as %s.', order_row.supplier_name, replace(normalized_status, '_', ' '))
      end,
      'observedAt', p_received_at
    ));
    select coalesce(jsonb_agg(entry.value order by entry.ordinality), '[]'::jsonb)
      into memory_evidence
    from jsonb_array_elements(memory_evidence) with ordinality as entry(value, ordinality)
    where entry.ordinality > greatest(jsonb_array_length(memory_evidence) - 20, 0);

    memory_sample_count := jsonb_array_length(memory_evidence);
    select count(*) filter (where entry.value->>'matched' = 'true')
      into memory_matched_count
    from jsonb_array_elements(memory_evidence) as entry(value);
    memory_statement := case
      when memory_matched_count = memory_sample_count then format(
        '%s matched all %s logged deliver%s.', order_row.supplier_name,
        memory_sample_count, case when memory_sample_count = 1 then 'y' else 'ies' end
      )
      else format(
        '%s had discrepancies on %s of %s logged deliver%s.',
        order_row.supplier_name, memory_sample_count - memory_matched_count,
        memory_sample_count, case when memory_sample_count = 1 then 'y' else 'ies' end
      )
    end;

    if memory_row.id is null then
      insert into public.restaurant_memories (
        restaurant_id, memory_type, statement, evidence, confidence,
        first_observed_at, last_updated_at, scope, source,
        affects_recommendations, affects_automation, status, dedupe_key
      ) values (
        p_restaurant_id, 'supplier_reliability', memory_statement,
        memory_evidence, least(0.90, 0.35 + (memory_sample_count - 1) * 0.08),
        p_received_at, p_received_at, 'supplier', 'supplier_delivery_outcomes',
        true, false, 'active', format(
          'supplier-delivery-outcome:%s', lower(trim(order_row.supplier_name))
        )
      ) returning * into memory_row;
    else
      update public.restaurant_memories
      set statement = case when status = 'corrected' then statement else memory_statement end,
        evidence = memory_evidence,
        confidence = least(0.90, 0.35 + (memory_sample_count - 1) * 0.08),
        last_updated_at = p_received_at,
        updated_at = now()
      where restaurant_id = p_restaurant_id and id = memory_row.id
      returning * into memory_row;
    end if;

    perform private.append_activity_event(
      p_restaurant_id, 'restaurant_memory_updated', 'memory',
      'Supplier reliability memory updated',
      left(coalesce(memory_row.correction, memory_row.statement), 1000),
      p_received_at, 'mise', 'system', null,
      'supplier_delivery_outcome', delivery_row.id::text,
      jsonb_build_array(
        jsonb_build_object('type', 'supplier_delivery', 'id', delivery_row.id),
        jsonb_build_object('type', 'action_outcome', 'id', outcome_row.id)
      ),
      array['mise', 'orders', 'memory']::text[], action_row.id, null,
      5::smallint, memory_row.confidence, 'completed', false, null,
      'memory', memory_row.id::text,
      format('supplier-order:%s', p_supplier_order_id),
      action_row.correlation_id, outcome_row.id,
      format('supplier_delivery_memory:%s', delivery_row.id),
      jsonb_build_object(
        'memoryId', memory_row.id,
        'supplierName', order_row.supplier_name,
        'sampleCount', memory_sample_count,
        'matchedCount', memory_matched_count
      ), null, null, memory_row.location_id
    );
  end if;

  perform private.append_activity_event(
    p_restaurant_id,
    case when normalized_status = 'discrepancy' then 'invoice_discrepancy_detected' else 'delivery_logged' end,
    'orders',
    case when normalized_status = 'received' then 'Delivery logged'
      when normalized_status = 'partially_received' then 'Partial delivery logged'
      else 'Delivery discrepancy recorded'
    end,
    format('%s delivery recorded with %s line%s.', order_row.supplier_name, line_count, case when line_count = 1 then '' else 's' end),
    p_received_at, 'mise', 'user', auth.uid(), 'supplier_delivery', delivery_row.id::text,
    jsonb_build_array(
      jsonb_build_object('type', 'supplier_order', 'id', p_supplier_order_id),
      jsonb_build_object('type', 'supplier_delivery', 'id', delivery_row.id)
    ),
    array['mise', 'orders', 'inventory']::text[], action_row.id, null, 5::smallint, null,
    case when normalized_status = 'received' then 'confirmed' else 'partially_completed' end,
    normalized_status <> 'received', null, 'supplier_order', p_supplier_order_id::text,
    format('supplier-order:%s', p_supplier_order_id), action_row.correlation_id, null,
    format('supplier_delivery:%s:%s', delivery_row.id, normalized_status),
    jsonb_build_object(
      'deliveryId', delivery_row.id,
      'supplierOrderId', p_supplier_order_id,
      'supplierName', order_row.supplier_name,
      'status', normalized_status,
      'lineCount', line_count,
      'outcomeId', outcome_row.id,
      'memoryId', memory_row.id
    ), null, null, null
  );

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, auth.uid(), 'supplier_delivery_recorded',
    'supplier_deliveries', delivery_row.id,
    jsonb_build_object(
      'supplier_order_id', p_supplier_order_id,
      'status', normalized_status,
      'line_count', line_count,
      'has_invoice_total', p_invoice_total is not null
    )
  );

  return jsonb_build_object(
    'outcome', 'applied',
    'delivery', to_jsonb(delivery_row),
    'status', normalized_status,
    'inventoryEventsRecorded', (
      select count(*) from public.supplier_delivery_items item
      where item.restaurant_id = p_restaurant_id
        and item.delivery_id = delivery_row.id
        and item.inventory_event_id is not null
    ),
    'outcomeId', outcome_row.id,
    'memoryId', memory_row.id,
    'actionOutcome', case when outcome_row.id is null then null else to_jsonb(outcome_row) end
  );
end;
$$;

create or replace function private.service_record_supplier_confirmation(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_supplier_order_id uuid,
  p_confirmation_status text,
  p_confirmation_reference text,
  p_expected_delivery_at timestamptz,
  p_normalized_details jsonb,
  p_source text,
  p_idempotency_key text
)
returns public.supplier_order_confirmations
language plpgsql
security definer
set search_path = ''
as $$
declare
  confirmation_row public.supplier_order_confirmations;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Supplier confirmation access denied' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.system_operational_controls controls
    where controls.singleton
      and controls.operational_mode <> 'normal'
  ) then
    raise exception 'Supplier confirmation ingestion is paused' using errcode = '55000';
  end if;
  if p_confirmation_status not in ('acknowledged', 'changed', 'rejected', 'unverified')
    or nullif(trim(p_source), '') is null
    or nullif(trim(p_idempotency_key), '') is null
    or jsonb_typeof(coalesce(p_normalized_details, '{}'::jsonb)) <> 'object'
  then
    raise exception 'Supplier confirmation is invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.supplier_orders orders
    where orders.restaurant_id = p_restaurant_id
      and orders.id = p_supplier_order_id
      and orders.status in ('sent', 'completed')
  ) then
    raise exception 'Supplier order is not awaiting confirmation' using errcode = '22023';
  end if;

  insert into public.supplier_order_confirmations (
    restaurant_id, supplier_order_id, confirmation_status,
    confirmation_reference, expected_delivery_at, normalized_details,
    received_at, source, idempotency_key
  ) values (
    p_restaurant_id, p_supplier_order_id, p_confirmation_status,
    nullif(left(trim(p_confirmation_reference), 512), ''), p_expected_delivery_at,
    coalesce(p_normalized_details, '{}'::jsonb), now(),
    left(trim(p_source), 80), left(trim(p_idempotency_key), 240)
  )
  on conflict (restaurant_id, idempotency_key) do nothing
  returning * into confirmation_row;

  if confirmation_row.id is null then
    select * into confirmation_row
    from public.supplier_order_confirmations
    where restaurant_id = p_restaurant_id
      and idempotency_key = left(trim(p_idempotency_key), 240);
    return confirmation_row;
  end if;

  perform private.append_activity_event(
    p_restaurant_id, 'supplier_confirmation_received', 'orders',
    'Supplier confirmation received',
    case p_confirmation_status
      when 'acknowledged' then 'The supplier acknowledged the order.'
      when 'changed' then 'The supplier changed part of the order. Review the confirmation.'
      when 'rejected' then 'The supplier rejected the order. Owner attention is required.'
      else 'A supplier response arrived but could not be fully verified.'
    end,
    confirmation_row.received_at, left(trim(p_source), 80), 'integration', p_actor_user_id,
    'supplier_confirmation', confirmation_row.id::text,
    jsonb_build_array(jsonb_build_object('type', 'supplier_confirmation', 'id', confirmation_row.id)),
    array['mise', 'orders', left(trim(p_source), 80)]::text[], null, null, 3::smallint, null,
    case when p_confirmation_status = 'acknowledged' then 'confirmed' else 'could_not_verify' end,
    p_confirmation_status <> 'acknowledged', null, 'supplier_order', p_supplier_order_id::text,
    format('supplier-order:%s', p_supplier_order_id), null, null,
    format('supplier_confirmation:%s', confirmation_row.id),
    jsonb_build_object(
      'confirmationId', confirmation_row.id,
      'supplierOrderId', p_supplier_order_id,
      'status', p_confirmation_status,
      'expectedDeliveryAt', p_expected_delivery_at
    ), null, null, null
  );
  return confirmation_row;
end;
$$;

create or replace function public.service_record_supplier_confirmation(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_supplier_order_id uuid,
  p_confirmation_status text,
  p_confirmation_reference text,
  p_expected_delivery_at timestamptz,
  p_normalized_details jsonb,
  p_source text,
  p_idempotency_key text
)
returns public.supplier_order_confirmations
language sql
security invoker
set search_path = ''
as $$
  select private.service_record_supplier_confirmation(
    p_actor_user_id, p_restaurant_id, p_supplier_order_id,
    p_confirmation_status, p_confirmation_reference,
    p_expected_delivery_at, p_normalized_details, p_source,
    p_idempotency_key
  );
$$;

-- Truthful one-time backfill for open recommendations and persisted orders.
-- This does not invent historical calculations: it exposes only durable state
-- that already existed when the activity/action model was installed.
insert into public.operational_issues (
  restaurant_id, category, severity, title, explanation, evidence,
  first_detected_at, last_detected_at, status, related_entity_type,
  related_entity_id, dedupe_key
)
select
  recommendation.restaurant_id, 'inventory',
  case recommendation.urgency when 'high' then 'critical' when 'medium' then 'warning' else 'watch' end,
  left(format('%s inventory risk', recommendation.item_name), 160),
  left(recommendation.reason, 2000),
  jsonb_build_array(jsonb_build_object(
    'type', 'purchase_recommendation', 'id', recommendation.id,
    'inventoryItemId', recommendation.inventory_item_id,
    'recommendedQuantity', recommendation.recommended_quantity,
    'unit', recommendation.unit,
    'observedAt', recommendation.created_at
  )),
  recommendation.created_at, recommendation.created_at, 'action_prepared',
  'inventory_item', recommendation.inventory_item_id::text,
  format('inventory-risk:%s', recommendation.inventory_item_id)
from (
  select distinct on (candidate.restaurant_id, candidate.inventory_item_id) candidate.*
  from public.purchase_recommendations candidate
  where candidate.status in ('pending', 'approved')
  order by candidate.restaurant_id, candidate.inventory_item_id, candidate.created_at desc, candidate.id desc
) recommendation
on conflict (restaurant_id, dedupe_key) do nothing;

insert into public.mise_actions (
  restaurant_id, action_type, execution_mode, status, autonomy_level,
  trigger_type, trigger_reference, reason, evidence, requested_by,
  approved_by, executed_at, result, idempotency_key, expected_impact,
  created_at, updated_at
)
select
  orders.restaurant_id, 'send_supplier_order', 'prepare',
  case when orders.status = 'draft' then 'waiting_for_approval' else 'executed' end,
  3::smallint, 'supplier_order_drafted', orders.id::text,
  format('Send the prepared %s supplier order after owner or manager approval.', orders.supplier_name),
  jsonb_build_array(jsonb_build_object('type', 'supplier_order', 'id', orders.id)),
  null::uuid,
  case when orders.status = 'draft' then null else orders.sent_by_user_id end,
  case when orders.status = 'draft' then null else coalesce(orders.sent_at, orders.created_at) end,
  case when orders.status = 'draft' then null else jsonb_build_object(
    'supplierOrderId', orders.id,
    'provider', orders.email_provider,
    'providerMessageId', orders.provider_message_id,
    'sentAt', orders.sent_at,
    'backfilled', true
  ) end,
  format('send_supplier_order:%s', orders.id),
  jsonb_build_object(
    'orderId', orders.id,
    'supplierName', orders.supplier_name,
    'deliveryDate', orders.delivery_date
  ),
  orders.created_at, coalesce(orders.sent_at, orders.created_at)
from public.supplier_orders orders
where orders.status in ('draft', 'sent', 'completed')
on conflict (restaurant_id, idempotency_key) do nothing;

insert into public.activity_events (
  restaurant_id, event_type, category, title, summary, occurred_at,
  source, actor_type, trigger_type, trigger_reference,
  evidence_references, source_systems, recommendation_id, autonomy_level,
  status, requires_attention, related_entity_type, related_entity_id,
  sequence_id, idempotency_key, metadata
)
select
  recommendation.restaurant_id,
  case when recommendation.status = 'pending' then 'approval_required' else 'order_approved' end,
  'approvals',
  case when recommendation.status = 'pending' then 'Approval required' else 'Order recommendation approved' end,
  case when recommendation.status = 'pending'
    then format('A %s %s %s reorder is ready for approval.', recommendation.recommended_quantity, recommendation.unit, recommendation.item_name)
    else format('%s is approved for ordering.', recommendation.item_name)
  end,
  recommendation.created_at, 'mise', 'system', 'persisted_recommendation_backfill',
  recommendation.id::text,
  jsonb_build_array(jsonb_build_object(
    'type', 'purchase_recommendation', 'id', recommendation.id,
    'summary', recommendation.reason, 'observedAt', recommendation.created_at
  )),
  array['mise', 'inventory', 'pos']::text[], recommendation.id, 3::smallint,
  case when recommendation.status = 'pending' then 'waiting_for_approval' else 'confirmed' end,
  recommendation.status = 'pending', 'purchase_recommendation', recommendation.id::text,
  format('inventory-order:%s', recommendation.inventory_item_id),
  format('purchase_recommendation:%s:%s', recommendation.id, recommendation.status),
  jsonb_build_object(
    'inventoryItemId', recommendation.inventory_item_id,
    'itemName', recommendation.item_name,
    'supplierName', recommendation.supplier_name,
    'recommendedQuantity', recommendation.recommended_quantity,
    'unit', recommendation.unit,
    'backfilled', true
  )
from public.purchase_recommendations recommendation
where recommendation.status in ('pending', 'approved')
on conflict (restaurant_id, idempotency_key) do nothing;

insert into public.activity_events (
  restaurant_id, event_type, category, title, summary, occurred_at,
  source, actor_type, actor_user_id, trigger_type, trigger_reference,
  evidence_references, source_systems, action_id, autonomy_level, status,
  requires_attention, related_entity_type, related_entity_id, sequence_id,
  correlation_id, idempotency_key, metadata
)
select
  orders.restaurant_id,
  case orders.status when 'draft' then 'order_prepared' when 'sent' then 'order_sent' else 'delivery_logged' end,
  case when orders.status = 'draft' then 'approvals' else 'orders' end,
  case orders.status
    when 'draft' then 'Supplier order prepared'
    when 'sent' then 'Supplier order sent'
    else 'Supplier order completed'
  end,
  case orders.status
    when 'draft' then format('%s order is prepared and waiting for approval.', orders.supplier_name)
    when 'sent' then format('%s order is recorded as sent.', orders.supplier_name)
    else format('%s order is recorded as received.', orders.supplier_name)
  end,
  coalesce(orders.sent_at, orders.created_at), 'mise', 'system', orders.sent_by_user_id,
  'persisted_supplier_order_backfill', orders.id::text,
  jsonb_build_array(jsonb_build_object('type', 'supplier_order', 'id', orders.id)),
  array['mise', 'orders']::text[], action.id, 3::smallint,
  case orders.status when 'draft' then 'waiting_for_approval' when 'sent' then 'sent' else 'completed' end,
  orders.status = 'draft', 'supplier_order', orders.id::text,
  format('supplier-order:%s', orders.id), action.correlation_id,
  case when orders.status = 'draft'
    then format('supplier_order:%s:draft', orders.id)
    else format('supplier_order:%s:%s', orders.id, orders.status)
  end,
  jsonb_build_object(
    'supplierName', orders.supplier_name,
    'deliveryDate', orders.delivery_date,
    'status', orders.status,
    'backfilled', true
  )
from public.supplier_orders orders
join public.mise_actions action
  on action.restaurant_id = orders.restaurant_id
 and action.idempotency_key = format('send_supplier_order:%s', orders.id)
where orders.status in ('draft', 'sent', 'completed')
on conflict (restaurant_id, idempotency_key) do nothing;

alter table public.operational_issues enable row level security;
alter table public.mise_actions enable row level security;
alter table public.action_outcomes enable row level security;
alter table public.restaurant_memories enable row level security;
alter table public.restaurant_autonomy_rules enable row level security;
alter table public.activity_events enable row level security;
alter table public.supplier_order_confirmations enable row level security;
alter table public.supplier_deliveries enable row level security;
alter table public.supplier_delivery_items enable row level security;

-- These tables are created after the original global operational-mode trigger
-- installation. Attach the same guard explicitly so authenticated RPC calls are
-- paused consistently in read-only and emergency modes.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'operational_issues',
    'mise_actions',
    'action_outcomes',
    'restaurant_memories',
    'restaurant_autonomy_rules',
    'activity_events',
    'supplier_order_confirmations',
    'supplier_deliveries',
    'supplier_delivery_items'
  ]
  loop
    execute format(
      'drop trigger if exists enforce_authenticated_operational_mode on public.%I',
      target_table
    );
    execute format(
      'create trigger enforce_authenticated_operational_mode
       before insert or update or delete on public.%I
       for each row execute function private.enforce_authenticated_operational_mode()',
      target_table
    );
  end loop;
end;
$$;

create policy "Members can view operational issues"
on public.operational_issues for select to authenticated
using (private.is_restaurant_member(restaurant_id));
create policy "Members can view Mise actions"
on public.mise_actions for select to authenticated
using (private.is_restaurant_member(restaurant_id));
create policy "Members can view action outcomes"
on public.action_outcomes for select to authenticated
using (private.is_restaurant_member(restaurant_id));
create policy "Members can view restaurant memories"
on public.restaurant_memories for select to authenticated
using (private.is_restaurant_member(restaurant_id));
create policy "Members can view autonomy rules"
on public.restaurant_autonomy_rules for select to authenticated
using (private.is_restaurant_member(restaurant_id));
create policy "Members can view activity events"
on public.activity_events for select to authenticated
using (private.is_restaurant_member(restaurant_id));
create policy "Members can view supplier confirmations"
on public.supplier_order_confirmations for select to authenticated
using (private.is_restaurant_member(restaurant_id));
create policy "Members can view supplier deliveries"
on public.supplier_deliveries for select to authenticated
using (private.is_restaurant_member(restaurant_id));
create policy "Members can view supplier delivery items"
on public.supplier_delivery_items for select to authenticated
using (private.is_restaurant_member(restaurant_id));

revoke all on public.operational_issues from anon, authenticated;
revoke all on public.mise_actions from anon, authenticated;
revoke all on public.action_outcomes from anon, authenticated;
revoke all on public.restaurant_memories from anon, authenticated;
revoke all on public.restaurant_autonomy_rules from anon, authenticated;
revoke all on public.activity_events from anon, authenticated;
revoke all on public.supplier_order_confirmations from anon, authenticated;
revoke all on public.supplier_deliveries from anon, authenticated;
revoke all on public.supplier_delivery_items from anon, authenticated;

revoke all on public.operational_issues from public, service_role;
revoke all on public.mise_actions from public, service_role;
revoke all on public.action_outcomes from public, service_role;
revoke all on public.restaurant_memories from public, service_role;
revoke all on public.restaurant_autonomy_rules from public, service_role;
revoke all on public.activity_events from public, service_role;
revoke all on public.supplier_order_confirmations from public, service_role;
revoke all on public.supplier_deliveries from public, service_role;
revoke all on public.supplier_delivery_items from public, service_role;

grant select on public.operational_issues to authenticated;
grant select on public.mise_actions to authenticated;
grant select on public.action_outcomes to authenticated;
grant select on public.restaurant_memories to authenticated;
grant select on public.restaurant_autonomy_rules to authenticated;
grant select on public.activity_events to authenticated;
grant select on public.supplier_order_confirmations to authenticated;
grant select on public.supplier_deliveries to authenticated;
grant select on public.supplier_delivery_items to authenticated;

grant select, insert, update, delete on public.operational_issues to service_role;
grant select, insert, update, delete on public.mise_actions to service_role;
grant select, insert on public.action_outcomes to service_role;
grant select, insert, update, delete on public.restaurant_memories to service_role;
grant select, insert, update, delete on public.restaurant_autonomy_rules to service_role;
grant select, insert on public.activity_events to service_role;
grant select, insert, update, delete on public.supplier_order_confirmations to service_role;
grant select, insert, update, delete on public.supplier_deliveries to service_role;
grant select, insert, update, delete on public.supplier_delivery_items to service_role;

revoke all on function private.reject_immutable_operational_record_mutation()
  from public, anon, authenticated, service_role;
revoke all on function private.append_activity_event(
  uuid, text, text, text, text, timestamptz, text, text, uuid, text,
  text, jsonb, text[], uuid, uuid, smallint, numeric, text, boolean,
  timestamptz, text, text, text, uuid, uuid, text, jsonb, text, text, uuid
) from public, anon, authenticated, service_role;
revoke all on function private.capture_operational_activity()
  from public, anon, authenticated, service_role;

revoke all on function public.service_append_activity_event(
  uuid, text, text, text, text, timestamptz, text, text, uuid, text,
  text, jsonb, text[], uuid, uuid, smallint, numeric, text, boolean,
  timestamptz, text, text, text, uuid, uuid, text, jsonb, text, text, uuid
) from public, anon, authenticated, service_role;
grant execute on function private.append_activity_event(
  uuid, text, text, text, text, timestamptz, text, text, uuid, text,
  text, jsonb, text[], uuid, uuid, smallint, numeric, text, boolean,
  timestamptz, text, text, text, uuid, uuid, text, jsonb, text, text, uuid
) to service_role;
grant execute on function public.service_append_activity_event(
  uuid, text, text, text, text, timestamptz, text, text, uuid, text,
  text, jsonb, text[], uuid, uuid, smallint, numeric, text, boolean,
  timestamptz, text, text, text, uuid, uuid, text, jsonb, text, text, uuid
) to service_role;

revoke all on function public.decide_mise_action(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.decide_mise_action(uuid, uuid, text)
  to authenticated;
revoke all on function public.service_record_mise_action_failure(
  uuid, uuid, uuid, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function private.service_record_mise_action_failure(
  uuid, uuid, uuid, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function private.service_record_mise_action_failure(
  uuid, uuid, uuid, text, text, text
) to service_role;
grant execute on function public.service_record_mise_action_failure(
  uuid, uuid, uuid, text, text, text
) to service_role;
revoke all on function public.update_restaurant_memory(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.update_restaurant_memory(uuid, uuid, text, text)
  to authenticated;
revoke all on function public.upsert_restaurant_autonomy_rule(
  uuid, text, text, smallint, boolean, boolean, bigint, text, text, uuid, time, time
) from public, anon, authenticated, service_role;
grant execute on function public.upsert_restaurant_autonomy_rule(
  uuid, text, text, smallint, boolean, boolean, bigint, text, text, uuid, time, time
) to authenticated;
revoke all on function public.record_supplier_delivery(
  uuid, uuid, text, timestamptz, jsonb, numeric, text
) from public, anon, authenticated, service_role;
grant execute on function public.record_supplier_delivery(
  uuid, uuid, text, timestamptz, jsonb, numeric, text
) to authenticated;
revoke all on function public.service_record_supplier_confirmation(
  uuid, uuid, uuid, text, text, timestamptz, jsonb, text, text
) from public, anon, authenticated, service_role;
revoke all on function private.service_record_supplier_confirmation(
  uuid, uuid, uuid, text, text, timestamptz, jsonb, text, text
) from public, anon, authenticated, service_role;
grant execute on function private.service_record_supplier_confirmation(
  uuid, uuid, uuid, text, text, timestamptz, jsonb, text, text
) to service_role;
grant execute on function public.service_record_supplier_confirmation(
  uuid, uuid, uuid, text, text, timestamptz, jsonb, text, text
) to service_role;

comment on table public.activity_events is
  'Append-only operator-facing activity generated from persisted calculations, state changes, actions, failures, and outcomes.';
comment on table public.mise_actions is
  'Permissioned action state. External actions remain waiting for approval until an authorized workflow records execution.';
comment on table public.action_outcomes is
  'Append-only measurement linking expected and actual action results.';
comment on table public.restaurant_memories is
  'Correctable restaurant-specific learning with evidence and explicit automation influence.';
comment on function public.record_supplier_delivery(uuid, uuid, text, timestamptz, jsonb, numeric, text) is
  'Records one idempotent supplier delivery and atomically projects verified receipt quantities through the authoritative inventory ledger.';
comment on function public.service_record_mise_action_failure(uuid, uuid, uuid, text, text, text) is
  'Records a bounded, user-visible supplier-send failure or ambiguous outcome without granting clients direct action mutation.';
