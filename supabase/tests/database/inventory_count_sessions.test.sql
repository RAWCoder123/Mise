begin;
select plan(12);

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

select function_privs_are(
  'public',
  'service_return_inventory_count_session',
  ARRAY['uuid', 'uuid', 'uuid']::name[],
  'service_role',
  ARRAY['EXECUTE']::name[],
  'count session return is service_role only'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.service_return_inventory_count_session(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot return count sessions through the service boundary'
);

select has_function(
  'public',
  'service_return_inventory_count_session',
  ARRAY['uuid', 'uuid', 'uuid']::name[],
  'count session return RPC exists'
);

select matches(
  pg_get_functiondef('public.service_return_inventory_count_session(uuid,uuid,uuid)'::regprocedure),
  'submitted',
  'count session return requires submitted status'
);

select * from finish();
rollback;
