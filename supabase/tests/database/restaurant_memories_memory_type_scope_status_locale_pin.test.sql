-- MISE-005CY: restaurant_memories.memory_type, scope, and status CHECKs
-- must keep the exact-token allowlists and pin ASCII shape under COLLATE
-- "C" so dump/restore cannot accept a memory-vocabulary identity the
-- restored C-locale gate would refuse.
begin;
select plan(53);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_memory_type_check'
  ),
  'restaurant_memories_memory_type_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_memory_type_check'
  ),
  'memory_type in \(''demand_pattern'', ''prep_habit'', ''waste_pattern'', ''supplier_reliability'', ''staff_timing'', ''safety_stock_preference'', ''service_window'', ''approval_preference'', ''seasonal_effect'', ''weather_effect'', ''local_event_effect'', ''menu_dependency'', ''operational_exception'', ''rejected_recommendation'', ''edited_quantity'', ''recurring_bottleneck'', ''action_outcome''\)',
  'restaurant_memories memory_type CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_memory_type_check'
  ),
  'memory_type collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'restaurant_memories memory_type CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_scope_check'
  ),
  'restaurant_memories_scope_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_scope_check'
  ),
  'scope in \(''restaurant'', ''location'', ''supplier'', ''item'', ''team'', ''service_period''\)',
  'restaurant_memories scope CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_scope_check'
  ),
  'scope collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'restaurant_memories scope CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_status_check'
  ),
  'restaurant_memories_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_status_check'
  ),
  'status in \(''active'', ''confirmed'', ''corrected'', ''dismissed'', ''forgotten'', ''disabled''\)',
  'restaurant_memories status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_status_check'
  ),
  'status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'restaurant_memories status CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('demand_pattern' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token demand_pattern matches under COLLATE C'
);

select is(
  ('prep_habit' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token prep_habit matches under COLLATE C'
);

select is(
  ('waste_pattern' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token waste_pattern matches under COLLATE C'
);

select is(
  ('supplier_reliability' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token supplier_reliability matches under COLLATE C'
);

select is(
  ('staff_timing' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token staff_timing matches under COLLATE C'
);

select is(
  ('safety_stock_preference' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token safety_stock_preference matches under COLLATE C'
);

select is(
  ('service_window' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token service_window matches under COLLATE C'
);

select is(
  ('approval_preference' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token approval_preference matches under COLLATE C'
);

select is(
  ('seasonal_effect' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token seasonal_effect matches under COLLATE C'
);

select is(
  ('weather_effect' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token weather_effect matches under COLLATE C'
);

select is(
  ('local_event_effect' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token local_event_effect matches under COLLATE C'
);

select is(
  ('menu_dependency' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token menu_dependency matches under COLLATE C'
);

select is(
  ('operational_exception' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token operational_exception matches under COLLATE C'
);

select is(
  ('rejected_recommendation' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token rejected_recommendation matches under COLLATE C'
);

select is(
  ('edited_quantity' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token edited_quantity matches under COLLATE C'
);

select is(
  ('recurring_bottleneck' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token recurring_bottleneck matches under COLLATE C'
);

select is(
  ('action_outcome' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token action_outcome matches under COLLATE C'
);

select is(
  ('supplier reliability' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced memory_type token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty memory_type token is rejected under COLLATE C'
);

select is(
  ('supplier_reliability!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated memory_type token is rejected under COLLATE C'
);

select is(
  (E'supplier_reliabilit\u00ff' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII memory_type token is rejected under COLLATE C'
);

select is(
  ('demand_pattern' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('prep_habit' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('waste_pattern' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('supplier_reliability' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('staff_timing' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('safety_stock_preference' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('service_window' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('approval_preference' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('seasonal_effect' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('weather_effect' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('local_event_effect' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('menu_dependency' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('operational_exception' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('rejected_recommendation' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('edited_quantity' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('recurring_bottleneck' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('action_outcome' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted memory_type tokens match under COLLATE C'
);

select is(
  ('restaurant' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token restaurant matches under COLLATE C'
);

select is(
  ('location' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token location matches under COLLATE C'
);

select is(
  ('supplier' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token supplier matches under COLLATE C'
);

select is(
  ('item' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token item matches under COLLATE C'
);

select is(
  ('team' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token team matches under COLLATE C'
);

select is(
  ('service_period' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token service_period matches under COLLATE C'
);

select is(
  ('service period' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced scope token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty scope token is rejected under COLLATE C'
);

select is(
  ('supplier!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated scope token is rejected under COLLATE C'
);

select is(
  (E'suppli\u00ebr' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII scope token is rejected under COLLATE C'
);

select is(
  ('restaurant' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('location' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('supplier' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('item' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('team' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('service_period' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted scope tokens match under COLLATE C'
);

select is(
  ('active' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token active matches under COLLATE C'
);

select is(
  ('confirmed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token confirmed matches under COLLATE C'
);

select is(
  ('corrected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token corrected matches under COLLATE C'
);

select is(
  ('dismissed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token dismissed matches under COLLATE C'
);

select is(
  ('forgotten' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token forgotten matches under COLLATE C'
);

select is(
  ('disabled' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token disabled matches under COLLATE C'
);

select is(
  ('active memory' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced status token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty status token is rejected under COLLATE C'
);

select is(
  ('active!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated status token is rejected under COLLATE C'
);

select is(
  (E'act\u00efve' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII status token is rejected under COLLATE C'
);

select is(
  ('active' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('confirmed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('corrected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('dismissed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('forgotten' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('disabled' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted status tokens match under COLLATE C'
);

select * from finish();
rollback;
