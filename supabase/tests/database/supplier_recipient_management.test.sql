begin;

select plan(24);

create or replace function pg_temp.try_execute(statement text)
returns boolean
language plpgsql
security invoker
as $$
begin
  execute statement;
  return true;
exception
  when others then
    return false;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '21212121-2121-4121-8121-212121212121',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'recipient-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '31313131-3131-4131-8131-313131313131',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'recipient-staff@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '41414141-4141-4141-8141-414141414141',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'recipient-owner-b@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values
  ('a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', 'Recipient Kitchen A', 'Fast casual'),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', 'Recipient Kitchen B', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', '21212121-2121-4121-8121-212121212121', 'manager', 'active'),
  ('a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', '31313131-3131-4131-8131-313131313131', 'staff', 'active'),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', '41414141-4141-4141-8141-414141414141', 'owner', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name)
values
  ('a4a4a4a4-a4a4-44a4-84a4-a4a4a4a4a4a4', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', 'Fresh Produce Co.', 'fresh produce co.'),
  ('b4b4b4b4-b4b4-44b4-84b4-b4b4b4b4b4b4', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', 'Cafe Supply', 'cafe supply');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name
)
values
  (
    'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'Tomatoes', 'Produce', 'lb', 10, 20, 6, 2,
    'a4a4a4a4-a4a4-44a4-84a4-a4a4a4a4a4a4', 'Fresh Produce Co.'
  ),
  (
    'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2',
    'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1',
    'Coffee', 'Beverage', 'lb', 10, 20, 6, 4,
    'b4b4b4b4-b4b4-44b4-84b4-b4b4b4b4b4b4', 'Cafe Supply'
  );

insert into public.supplier_recipients (id, restaurant_id, supplier_id, supplier_name, email)
values
  (
    'a3a3a3a3-a3a3-43a3-83a3-a3a3a3a3a3a3',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'a4a4a4a4-a4a4-44a4-84a4-a4a4a4a4a4a4',
    'Fresh Produce Co.', 'old@fresh.test'
  ),
  (
    'b3b3b3b3-b3b3-43b3-83b3-b3b3b3b3b3b3',
    'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1',
    'b4b4b4b4-b4b4-44b4-84b4-b4b4b4b4b4b4',
    'Cafe Supply', 'old@cafe.test'
  );

select is(
  has_table_privilege('authenticated', 'public.supplier_recipients', 'INSERT'),
  false,
  'authenticated clients cannot insert supplier recipients directly'
);
select is(
  has_table_privilege('authenticated', 'public.supplier_recipients', 'UPDATE'),
  false,
  'authenticated clients cannot update supplier recipients directly'
);
select is(
  has_table_privilege('authenticated', 'public.supplier_recipients', 'DELETE'),
  false,
  'authenticated clients cannot delete supplier recipients directly'
);
select is(
  has_function_privilege('authenticated', 'public.upsert_supplier_recipient(uuid,uuid,text)', 'EXECUTE'),
  true,
  'authenticated clients can execute the guarded supplier recipient RPC'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '21212121-2121-4121-8121-212121212121', true);
select lives_ok(
  $sql$select public.upsert_supplier_recipient(
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'a4a4a4a4-a4a4-44a4-84a4-a4a4a4a4a4a4',
    ' MANAGER@FRESH.TEST '
  )$sql$,
  'manager can save an allowlisted supplier recipient'
);
reset role;

select is(
  (select email from public.supplier_recipients where id = 'a3a3a3a3-a3a3-43a3-83a3-a3a3a3a3a3a3'),
  'manager@fresh.test',
  'supplier email is trimmed and normalized'
);
select is(
  (select supplier_name from public.supplier_recipients where id = 'a3a3a3a3-a3a3-43a3-83a3-a3a3a3a3a3a3'),
  'Fresh Produce Co.',
  'authoritative supplier casing is preserved'
);
select is(
  (select count(*) from public.supplier_recipients where restaurant_id = 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1'),
  1::bigint,
  'supplier-ID upsert preserves one restaurant supplier identity'
);
select is(
  (select count(*) from public.audit_logs where action = 'supplier_recipient_updated' and entity_id = 'a3a3a3a3-a3a3-43a3-83a3-a3a3a3a3a3a3'),
  1::bigint,
  'recipient change is audited once'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '21212121-2121-4121-8121-212121212121', true);
select lives_ok(
  $sql$select public.upsert_supplier_recipient(
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'a4a4a4a4-a4a4-44a4-84a4-a4a4a4a4a4a4',
    'manager@fresh.test'
  )$sql$,
  'replaying the same manager save is idempotent'
);
reset role;
select is(
  (select count(*) from public.audit_logs where action = 'supplier_recipient_updated' and entity_id = 'a3a3a3a3-a3a3-43a3-83a3-a3a3a3a3a3a3'),
  1::bigint,
  'idempotent replay does not forge another audit change'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '31313131-3131-4131-8131-313131313131', true);
select is(
  pg_temp.try_execute($sql$select public.upsert_supplier_recipient(
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'a4a4a4a4-a4a4-44a4-84a4-a4a4a4a4a4a4', 'staff@fresh.test'
  )$sql$),
  false,
  'staff cannot mutate a supplier recipient through the RPC'
);
reset role;
select is(
  (select email from public.supplier_recipients where id = 'a3a3a3a3-a3a3-43a3-83a3-a3a3a3a3a3a3'),
  'manager@fresh.test',
  'staff denial leaves the recipient unchanged'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '31313131-3131-4131-8131-313131313131', true);
select is(
  (select count(*) from public.supplier_recipients),
  1::bigint,
  'staff can read only their active restaurant recipient directory'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '21212121-2121-4121-8121-212121212121', true);
select is(
  pg_temp.try_execute($sql$select public.upsert_supplier_recipient(
    'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1',
    'b4b4b4b4-b4b4-44b4-84b4-b4b4b4b4b4b4', 'forged@cafe.test'
  )$sql$),
  false,
  'manager cannot write another restaurant recipient'
);
select is(
  pg_temp.try_execute($sql$select public.upsert_supplier_recipient(
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'a5a5a5a5-a5a5-45a5-85a5-a5a5a5a5a5a5', 'orders@invented.test'
  )$sql$),
  false,
  'manager cannot inject a supplier outside the restaurant catalog'
);
select is(
  pg_temp.try_execute($sql$select public.upsert_supplier_recipient(
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'a4a4a4a4-a4a4-44a4-84a4-a4a4a4a4a4a4', 'not-an-email'
  )$sql$),
  false,
  'manager cannot save an invalid supplier email'
);
select is(
  pg_temp.try_execute($sql$select public.upsert_supplier_recipient(
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', null::uuid, 'orders@fresh.test'
  )$sql$),
  false,
  'manager cannot save a recipient without durable supplier identity'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '41414141-4141-4141-8141-414141414141', true);
select lives_ok(
  $sql$select public.upsert_supplier_recipient(
    'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1',
    'b4b4b4b4-b4b4-44b4-84b4-b4b4b4b4b4b4', 'OWNER@CAFE.TEST'
  )$sql$,
  'owner can save their own restaurant supplier recipient'
);
reset role;
select is(
  (select email from public.supplier_recipients where id = 'b3b3b3b3-b3b3-43b3-83b3-b3b3b3b3b3b3'),
  'owner@cafe.test',
  'owner save is normalized and persisted in the correct tenant'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '21212121-2121-4121-8121-212121212121', true);
select is(
  (select count(*) from public.supplier_recipients),
  1::bigint,
  'manager sees one recipient from their own restaurant'
);
select is(
  (select count(*) from public.supplier_recipients where restaurant_id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  0::bigint,
  'manager cannot read another restaurant recipient'
);
reset role;

select is(
  (
    select count(*)
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'supplier_recipients_restaurant_supplier_id_uidx'
  ),
  1::bigint,
  'durable restaurant supplier identity has a unique index'
);
select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.supplier_recipients'::regclass
      and conname in ('supplier_recipients_name_bounds_check', 'supplier_recipients_email_format_check')
  ),
  2::bigint,
  'supplier recipient table enforces bounded name and email checks'
);

select * from finish();
rollback;
