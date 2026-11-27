create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' supplier_order_sent_at_evidence.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(9);

create or replace function pg_temp.error_of(statement text)
returns text language plpgsql as $$
begin execute statement; return null;
exception when others then return sqlerrm;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('f1111111-1111-4111-8111-11111111111f', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'supplier-order-sent-at-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('f0000000-0000-4000-8000-00000000000f', 'Supplier Order Sent-At Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('f0000000-0000-4000-8000-00000000000f', 'f1111111-1111-4111-8111-11111111111f', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('f0000000-0000-4000-8000-000000000090', 'f0000000-0000-4000-8000-00000000000f', 'Evidence Produce Sent At', 'evidence produce sent at');

select has_function(
  'private',
  'enforce_supplier_order_sent_at_evidence',
  'supplier order sent_at evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.supplier_orders (
      restaurant_id, supplier_id, supplier_name, order_message, status,
      sent_at
    ) values (
      'f0000000-0000-4000-8000-00000000000f',
      'f0000000-0000-4000-8000-000000000090',
      'Evidence Produce Sent At', 'Minted sent without send time', 'sent',
      null
    )
  $sql$),
  'Supplier order send time is required',
  'direct supplier_orders insert cannot mint sent status without sent_at'
);

select is(
  pg_temp.error_of($sql$
    insert into public.supplier_orders (
      restaurant_id, supplier_id, supplier_name, order_message, status,
      sent_at
    ) values (
      'f0000000-0000-4000-8000-00000000000f',
      'f0000000-0000-4000-8000-000000000090',
      'Evidence Produce Sent At', 'Minted completed without send time', 'completed',
      null
    )
  $sql$),
  'Supplier order send time is required',
  'direct supplier_orders insert cannot mint completed status without sent_at'
);

select is(
  pg_temp.error_of($sql$
    insert into public.supplier_orders (
      id, restaurant_id, supplier_id, supplier_name, order_message, status,
      sent_at, sent_by_user_id
    ) values (
      'f0000000-0000-4000-8000-0000000000aa',
      'f0000000-0000-4000-8000-00000000000f',
      'f0000000-0000-4000-8000-000000000090',
      'Evidence Produce Sent At', 'Attributed sent order', 'sent',
      clock_timestamp(), 'f1111111-1111-4111-8111-11111111111f'
    )
  $sql$),
  null,
  'direct supplier_orders insert with sent_at remains allowed for sent status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.supplier_orders (
      id, restaurant_id, supplier_id, supplier_name, order_message, status,
      sent_at, sent_by_user_id
    ) values (
      'f0000000-0000-4000-8000-0000000000ab',
      'f0000000-0000-4000-8000-00000000000f',
      'f0000000-0000-4000-8000-000000000090',
      'Evidence Produce Sent At', 'Attributed completed order', 'completed',
      clock_timestamp(), 'f1111111-1111-4111-8111-11111111111f'
    )
  $sql$),
  null,
  'direct supplier_orders insert with sent_at remains allowed for completed status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.supplier_orders (
      id, restaurant_id, supplier_id, supplier_name, order_message, status
    ) values (
      'f0000000-0000-4000-8000-0000000000ac',
      'f0000000-0000-4000-8000-00000000000f',
      'f0000000-0000-4000-8000-000000000090',
      'Evidence Produce Sent At', 'Open draft without send time', 'draft'
    )
  $sql$),
  null,
  'direct supplier_orders insert can open draft without sent_at'
);

select is(
  pg_temp.error_of($sql$
    update public.supplier_orders
    set status = 'sent',
      sent_by_user_id = 'f1111111-1111-4111-8111-11111111111f',
      sent_at = clock_timestamp()
    where id = 'f0000000-0000-4000-8000-0000000000ac'
  $sql$),
  null,
  'mark-sent UPDATE with sent_at remains allowed (INSERT-only tip)'
);

select is(
  (
    select (sent_at is not null)
    from public.supplier_orders
    where id = 'f0000000-0000-4000-8000-0000000000ac'
  ),
  true,
  'mark-sent UPDATE keeps the stamped sent_at'
);

select is(
  (
    select status
    from public.supplier_orders
    where id = 'f0000000-0000-4000-8000-0000000000ac'
  ),
  'sent',
  'mark-sent UPDATE reaches sent status under the INSERT-only tip'
);

select * from finish();
rollback;
