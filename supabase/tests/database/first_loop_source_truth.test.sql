begin;

select plan(25);

select ok(exists (
  select 1 from pg_catalog.pg_attribute
  where attrelid = 'public.pos_sales'::regclass and attname = 'occurred_at' and not attisdropped
), 'Square sales expose occurred_at');
select ok(exists (
  select 1 from pg_catalog.pg_attribute
  where attrelid = 'public.pos_sales'::regclass and attname = 'pos_location_id' and not attisdropped
), 'Square sales expose selected provider location identity');
select ok(exists (
  select 1 from pg_catalog.pg_attribute
  where attrelid = 'public.pos_sales'::regclass and attname = 'external_catalog_item_id' and not attisdropped
), 'Square sales expose catalog item identity');
select ok(exists (
  select 1 from pg_catalog.pg_attribute
  where attrelid = 'public.pos_sales'::regclass and attname = 'external_variation_id' and not attisdropped
), 'Square sales expose variation identity');

select ok(exists (
  select 1 from pg_catalog.pg_attribute
  where attrelid = 'public.purchase_recommendations'::regclass and attname = 'confidence' and not attisdropped
), 'recommendations expose confidence');
select ok(exists (
  select 1 from pg_catalog.pg_attribute
  where attrelid = 'public.purchase_recommendations'::regclass and attname = 'source_evidence' and not attisdropped
), 'recommendations expose source evidence');
select ok((
  select attnotnull from pg_catalog.pg_attribute
  where attrelid = 'public.purchase_recommendations'::regclass and attname = 'confidence'
), 'confidence is non-null');
select ok((
  select attnotnull from pg_catalog.pg_attribute
  where attrelid = 'public.purchase_recommendations'::regclass and attname = 'source_evidence'
), 'source evidence is non-null');

select ok(to_regclass('public.pos_locations_one_planning_location_per_integration') is not null,
  'a partial unique index protects the single planning location');
select ok(to_regclass('public.pos_catalog_item_mappings_current_provider_identity_key') is not null,
  'a partial unique index protects current provider catalog identity');

select is(has_function_privilege('anon', 'public.select_pos_location(uuid,uuid)', 'EXECUTE'), false,
  'anonymous callers cannot select a planning location');
select is(has_function_privilege('authenticated', 'public.select_pos_location(uuid,uuid)', 'EXECUTE'), true,
  'authenticated callers can reach the role-checked location boundary');
select is(has_function_privilege('service_role', 'public.select_pos_location(uuid,uuid)', 'EXECUTE'), false,
  'the service role cannot impersonate a manager to select a location');
select is(has_function_privilege('authenticated', 'public.review_pos_catalog_mapping(uuid,uuid,text)', 'EXECUTE'), true,
  'authenticated callers can reach the role-checked catalog boundary');
select is(has_function_privilege('anon', 'public.review_pos_catalog_mapping(uuid,uuid,text)', 'EXECUTE'), false,
  'anonymous callers cannot review catalog mappings');
select is(has_function_privilege('service_role', 'public.review_pos_catalog_mapping(uuid,uuid,text)', 'EXECUTE'), false,
  'the service role cannot impersonate a manager to review mappings');
select is(has_function_privilege(
  'service_role', 'private.recommendation_source_is_current(uuid,uuid,bigint,jsonb)', 'EXECUTE'
), false, 'the provenance predicate is not a standalone service API');
select is(has_function_privilege('authenticated', 'public.approve_purchase_recommendation(uuid,uuid,numeric)', 'EXECUTE'), true,
  'authenticated callers can reach fail-closed recommendation approval');
select is(has_function_privilege('anon', 'public.approve_purchase_recommendation(uuid,uuid,numeric)', 'EXECUTE'), false,
  'anonymous callers cannot approve recommendations');

select like(
  pg_get_functiondef('public.review_pos_catalog_mapping(uuid,uuid,text)'::regprocedure),
  '%mapping.restaurant_id = p_restaurant_id%location.selected_for_planning%',
  'mapping review binds tenant identity to the selected planning location'
);
select like(
  pg_get_functiondef('private.recommendation_source_is_current(uuid,uuid,bigint,jsonb)'::regprocedure),
  '%event_type = ''count''%effective_at%planningRevision%',
  'provenance checks the current physical count and planning revision'
);
select like(
  pg_get_functiondef('public.approve_purchase_recommendation(uuid,uuid,numeric)'::regprocedure),
  '%recommendation_source_is_current%',
  'recommendation approval rejects stale provenance'
);
select ok(exists (
  select 1 from pg_catalog.pg_constraint
  where conrelid = 'public.purchase_recommendations'::regclass
    and conname = 'purchase_recommendations_source_evidence_check'
), 'bounded source evidence has a database constraint');
select ok((select relrowsecurity from pg_catalog.pg_class where oid = 'public.pos_sales'::regclass),
  'POS sales remain RLS protected');
select ok((select relrowsecurity from pg_catalog.pg_class where oid = 'public.purchase_recommendations'::regclass),
  'recommendations remain RLS protected');

select * from finish();
rollback;
