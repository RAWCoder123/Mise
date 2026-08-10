begin;
select plan(6);

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
  ARRAY['service_role'],
  'count session begin is service_role only'
);

select function_privs_are(
  'public',
  'service_approve_inventory_count_session',
  ARRAY['service_role'],
  'count session approve is service_role only'
);

select * from finish();
rollback;
