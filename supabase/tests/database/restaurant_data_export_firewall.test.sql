begin;

select plan(5);

select is(
  (select max_attempts from private.edge_function_policy('export-restaurant-data')),
  4,
  'restaurant export allows four bounded attempts per window'
);

select is(
  (select window_seconds from private.edge_function_policy('export-restaurant-data')),
  300,
  'restaurant export uses a five-minute rate window'
);

select is(
  (select allowed_roles from private.edge_function_policy('export-restaurant-data')),
  array['owner', 'admin']::text[],
  'restaurant export is restricted to owners and admins'
);

select ok(
  position('export-restaurant-data' in pg_get_constraintdef(oid)) > 0,
  'the Edge event constraint accepts restaurant export events'
)
from pg_constraint
where connamespace = 'private'::regnamespace
  and conname = 'edge_function_security_events_function_name_check';

select is(
  has_function_privilege(
    'authenticated',
    'private.edge_function_policy(text)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot inspect private Edge policy directly'
);

select * from finish();
rollback;
