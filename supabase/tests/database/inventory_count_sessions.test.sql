begin;
select plan(8);

select has_table('public', 'inventory_count_sessions', 'inventory_count_sessions exists');
select has_table('public', 'inventory_count_lines', 'inventory_count_lines exists');

select policies_are(
  'public',
  'inventory_count_sessions',
  ARRAY['Members can read inventory count sessions']
);

select policies_are(
  'public',
  'inventory_count_lines',
  ARRAY['Members can read inventory count lines']
);

select function_privs_are(
  'public',
  'service_begin_inventory_count_session',
  ARRAY['uuid', 'uuid', 'text']::name[],
  'service_role',
  ARRAY['EXECUTE']::name[],
  'count session begin is service_role only'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.service_begin_inventory_count_session(uuid,uuid,text)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot begin count sessions through the service boundary'
);

select function_privs_are(
  'public',
  'service_approve_inventory_count_session',
  ARRAY['uuid', 'uuid', 'uuid', 'bigint', 'jsonb', 'jsonb']::name[],
  'service_role',
  ARRAY['EXECUTE']::name[],
  'count session approve is service_role only'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.service_approve_inventory_count_session(uuid,uuid,uuid,bigint,jsonb,jsonb)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot approve count sessions through the service boundary'
);

select * from finish();
rollback;
