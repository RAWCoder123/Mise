create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' purchase_order_submitted_at_evidence.test.sql
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
  ('d1111111-1111-4111-8111-11111111111d', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'purchase-order-submitted-at-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('d0000000-0000-4000-8000-00000000000d', 'Purchase Order Submitted At Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('d0000000-0000-4000-8000-00000000000d', 'd1111111-1111-4111-8111-11111111111d', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('d0000000-0000-4000-8000-000000000090', 'd0000000-0000-4000-8000-00000000000d', 'Evidence Produce Submitted', 'evidence produce submitted');

select has_function(
  'private',
  'enforce_purchase_order_submitted_at_evidence',
  'purchase order submitted_at evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_orders (
      restaurant_id, supplier_id, supplier_name, status, order_payload,
      subtotal_estimate, submitted_at
    ) values (
      'd0000000-0000-4000-8000-00000000000d',
      'd0000000-0000-4000-8000-000000000090',
      'Evidence Produce Submitted', 'submitted', '{"items":[]}'::jsonb,
      0, null
    )
  $sql$),
  'Purchase order submission time is required',
  'direct purchase_orders insert cannot mint submitted status without submitted_at'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_orders (
      restaurant_id, supplier_id, supplier_name, status, order_payload,
      subtotal_estimate, submitted_at
    ) values (
      'd0000000-0000-4000-8000-00000000000d',
      'd0000000-0000-4000-8000-000000000090',
      'Evidence Produce Submitted', 'received', '{"items":[]}'::jsonb,
      0, null
    )
  $sql$),
  'Purchase order submission time is required',
  'direct purchase_orders insert cannot mint received status without submitted_at'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_orders (
      id, restaurant_id, supplier_id, supplier_name, status, order_payload,
      subtotal_estimate, submitted_at
    ) values (
      'd0000000-0000-4000-8000-0000000000aa',
      'd0000000-0000-4000-8000-00000000000d',
      'd0000000-0000-4000-8000-000000000090',
      'Evidence Produce Submitted', 'submitted', '{"items":[]}'::jsonb,
      12.5, '2024-01-02T00:00:00Z'::timestamptz
    )
  $sql$),
  null,
  'direct purchase_orders insert with submitted_at remains allowed for submitted status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_orders (
      id, restaurant_id, supplier_id, supplier_name, status, order_payload,
      subtotal_estimate, submitted_at
    ) values (
      'd0000000-0000-4000-8000-0000000000ab',
      'd0000000-0000-4000-8000-00000000000d',
      'd0000000-0000-4000-8000-000000000090',
      'Evidence Produce Submitted', 'received', '{"items":[]}'::jsonb,
      18.0, '2024-01-03T00:00:00Z'::timestamptz
    )
  $sql$),
  null,
  'direct purchase_orders insert with submitted_at remains allowed for received status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_orders (
      id, restaurant_id, supplier_id, supplier_name, status, order_payload,
      subtotal_estimate
    ) values (
      'd0000000-0000-4000-8000-0000000000ac',
      'd0000000-0000-4000-8000-00000000000d',
      'd0000000-0000-4000-8000-000000000090',
      'Evidence Produce Submitted', 'draft', '{"items":[]}'::jsonb,
      0
    )
  $sql$),
  null,
  'direct purchase_orders insert can open draft without submitted_at'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_orders (
      id, restaurant_id, supplier_id, supplier_name, status, order_payload,
      subtotal_estimate
    ) values (
      'd0000000-0000-4000-8000-0000000000ad',
      'd0000000-0000-4000-8000-00000000000d',
      'd0000000-0000-4000-8000-000000000090',
      'Evidence Produce Submitted', 'cancelled', '{"items":[]}'::jsonb,
      0
    )
  $sql$),
  null,
  'direct purchase_orders insert can open cancelled without submitted_at'
);

select is(
  pg_temp.error_of($sql$
    update public.purchase_orders
    set status = 'submitted',
      submitted_at = clock_timestamp(),
      updated_at = clock_timestamp()
    where id = 'd0000000-0000-4000-8000-0000000000ac'
  $sql$),
  null,
  'submit UPDATE with submitted_at remains allowed (INSERT-only tip)'
);

select is(
  (
    select (submitted_at is not null)
    from public.purchase_orders
    where id = 'd0000000-0000-4000-8000-0000000000ac'
  ),
  true,
  'submit UPDATE keeps the stamped submitted_at'
);

select * from finish();
rollback;
