create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' supplier_order_sent_by_evidence.test.sql
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
  ('e1111111-1111-4111-8111-11111111111e', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'supplier-order-sent-by-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('e0000000-0000-4000-8000-00000000000e', 'Supplier Order Sent-By Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('e0000000-0000-4000-8000-00000000000e', 'e1111111-1111-4111-8111-11111111111e', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('e0000000-0000-4000-8000-000000000090', 'e0000000-0000-4000-8000-00000000000e', 'Evidence Produce Sent', 'evidence produce sent');

select has_function(
  'private',
  'enforce_supplier_order_sent_by_evidence',
  'supplier order sent_by evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.supplier_orders (
      restaurant_id, supplier_id, supplier_name, order_message, status,
      sent_by_user_id
    ) values (
      'e0000000-0000-4000-8000-00000000000e',
      'e0000000-0000-4000-8000-000000000090',
      'Evidence Produce Sent', 'Minted sent without actor', 'sent',
      null
    )
  $sql$),
  'Supplier order sender is required',
  'direct supplier_orders insert cannot mint sent status without sent_by_user_id'
);

select is(
  pg_temp.error_of($sql$
    insert into public.supplier_orders (
      restaurant_id, supplier_id, supplier_name, order_message, status,
      sent_by_user_id
    ) values (
      'e0000000-0000-4000-8000-00000000000e',
      'e0000000-0000-4000-8000-000000000090',
      'Evidence Produce Sent', 'Minted completed without actor', 'completed',
      null
    )
  $sql$),
  'Supplier order sender is required',
  'direct supplier_orders insert cannot mint completed status without sent_by_user_id'
);

select is(
  pg_temp.error_of($sql$
    insert into public.supplier_orders (
      id, restaurant_id, supplier_id, supplier_name, order_message, status,
      sent_by_user_id
    ) values (
      'e0000000-0000-4000-8000-0000000000aa',
      'e0000000-0000-4000-8000-00000000000e',
      'e0000000-0000-4000-8000-000000000090',
      'Evidence Produce Sent', 'Attributed sent order', 'sent',
      'e1111111-1111-4111-8111-11111111111e'
    )
  $sql$),
  null,
  'direct supplier_orders insert with sent_by_user_id remains allowed for sent status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.supplier_orders (
      id, restaurant_id, supplier_id, supplier_name, order_message, status,
      sent_by_user_id
    ) values (
      'e0000000-0000-4000-8000-0000000000ab',
      'e0000000-0000-4000-8000-00000000000e',
      'e0000000-0000-4000-8000-000000000090',
      'Evidence Produce Sent', 'Attributed completed order', 'completed',
      'e1111111-1111-4111-8111-11111111111e'
    )
  $sql$),
  null,
  'direct supplier_orders insert with sent_by_user_id remains allowed for completed status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.supplier_orders (
      id, restaurant_id, supplier_id, supplier_name, order_message, status
    ) values (
      'e0000000-0000-4000-8000-0000000000ac',
      'e0000000-0000-4000-8000-00000000000e',
      'e0000000-0000-4000-8000-000000000090',
      'Evidence Produce Sent', 'Open draft without actor', 'draft'
    )
  $sql$),
  null,
  'direct supplier_orders insert can open draft without sent_by_user_id'
);

select is(
  pg_temp.error_of($sql$
    update public.supplier_orders
    set status = 'sent',
      sent_by_user_id = 'e1111111-1111-4111-8111-11111111111e',
      sent_at = clock_timestamp()
    where id = 'e0000000-0000-4000-8000-0000000000ac'
  $sql$),
  null,
  'mark-sent UPDATE with sent_by_user_id remains allowed (INSERT-only tip)'
);

select is(
  (
    select (sent_by_user_id is not null)
    from public.supplier_orders
    where id = 'e0000000-0000-4000-8000-0000000000ac'
  ),
  true,
  'mark-sent UPDATE keeps the stamped sent_by_user_id'
);

select is(
  (
    select status
    from public.supplier_orders
    where id = 'e0000000-0000-4000-8000-0000000000ac'
  ),
  'sent',
  'mark-sent UPDATE reaches sent status under the INSERT-only tip'
);

select * from finish();
rollback;
