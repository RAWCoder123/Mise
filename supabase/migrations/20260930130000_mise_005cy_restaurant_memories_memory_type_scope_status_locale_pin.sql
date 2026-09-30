-- MISE-005CY: pin restaurant_memories.memory_type, scope, and status
-- CHECKs to COLLATE "C", preserving the exact-token allowlists.
--
-- restaurant_memories stores learning-memory vocabulary under bare IN
-- allowlists from operational_backend_foundation:
--   memory_type in (
--     'demand_pattern', 'prep_habit', 'waste_pattern',
--     'supplier_reliability', 'staff_timing',
--     'safety_stock_preference', 'service_window',
--     'approval_preference', 'seasonal_effect', 'weather_effect',
--     'local_event_effect', 'menu_dependency',
--     'operational_exception', 'rejected_recommendation',
--     'edited_quantity', 'recurring_bottleneck', 'action_outcome'
--   )
--   scope in (
--     'restaurant', 'location', 'supplier', 'item', 'team',
--     'service_period'
--   )
--   status in (
--     'active', 'confirmed', 'corrected', 'dismissed', 'forgotten',
--     'disabled'
--   )
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only
-- (supplier-delivery outcomes use 'supplier_reliability' / 'supplier' /
-- 'active'; decide_restaurant_memory uses 'confirmed' / 'corrected' /
-- 'dismissed' / 'forgotten' / 'disabled').
--
-- memory_type gates recommendation filtering and learning-signal routing.
-- scope gates restaurant / location / supplier / item / team /
-- service_period attribution. status gates active recommendation
-- influence and owner correction lifecycle. POSIX character classes follow
-- database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved
-- locale drift on this cluster; open sibling pins cover
-- restaurant_memories.dedupe_key only with writer/charset work (avoided
-- here), leaving memory_type / scope / status on bare IN.
--
-- If LC_CTYPE drifted under a bare-IN memory-vocabulary CHECK,
-- dump/restore could accept memory-type / scope / status bytes the
-- restored C-locale path (and sibling machine-identity gates) would
-- refuse — or the reverse — breaking restaurant-memory lifecycle across
-- restore.
--
-- Scope:
--   - Replace restaurant_memories_memory_type_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
--   - Replace restaurant_memories_scope_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
--   - Replace restaurant_memories_status_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite supplier-delivery / decide_restaurant_memory writers,
-- dedupe_key (needs writer/charset), statement/source/correction free
-- text, mise_actions (#510), operational_issues (#507–#509), or
-- activity_events allowlists.
-- Timestamp after MISE-005CX (#510).

alter table public.restaurant_memories
  drop constraint if exists restaurant_memories_memory_type_check;

alter table public.restaurant_memories
  add constraint restaurant_memories_memory_type_check
  check (
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
  );

comment on constraint restaurant_memories_memory_type_check
  on public.restaurant_memories is
  'MISE-005CY: exact memory_type allowlist plus ASCII shape under COLLATE "C". Restaurant memory type.';

comment on column public.restaurant_memories.memory_type is
  'Restaurant memory type. Allowed values: demand_pattern, prep_habit, waste_pattern, supplier_reliability, staff_timing, safety_stock_preference, service_window, approval_preference, seasonal_effect, weather_effect, local_event_effect, menu_dependency, operational_exception, rejected_recommendation, edited_quantity, recurring_bottleneck, action_outcome under COLLATE "C".';

alter table public.restaurant_memories
  drop constraint if exists restaurant_memories_scope_check;

alter table public.restaurant_memories
  add constraint restaurant_memories_scope_check
  check (
    scope in (
      'restaurant',
      'location',
      'supplier',
      'item',
      'team',
      'service_period'
    )
    and scope collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint restaurant_memories_scope_check
  on public.restaurant_memories is
  'MISE-005CY: exact restaurant/location/supplier/item/team/service_period allowlist plus ASCII shape under COLLATE "C". Restaurant memory scope.';

comment on column public.restaurant_memories.scope is
  'Restaurant memory scope. Allowed values: restaurant, location, supplier, item, team, service_period under COLLATE "C".';

alter table public.restaurant_memories
  drop constraint if exists restaurant_memories_status_check;

alter table public.restaurant_memories
  add constraint restaurant_memories_status_check
  check (
    status in (
      'active',
      'confirmed',
      'corrected',
      'dismissed',
      'forgotten',
      'disabled'
    )
    and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint restaurant_memories_status_check
  on public.restaurant_memories is
  'MISE-005CY: exact active/confirmed/corrected/dismissed/forgotten/disabled allowlist plus ASCII shape under COLLATE "C". Restaurant memory status.';

comment on column public.restaurant_memories.status is
  'Restaurant memory status. Allowed values: active, confirmed, corrected, dismissed, forgotten, disabled under COLLATE "C".';
