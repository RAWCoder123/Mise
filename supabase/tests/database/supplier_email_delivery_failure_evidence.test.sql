create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' supplier_email_delivery_failure_evidence.test.sql
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
  ('a1111111-1111-4111-8111-11111111111a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'supplier-email-failure-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('a0000000-0000-4000-8000-00000000000a', 'Supplier Email Failure Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('a0000000-0000-4000-8000-00000000000a', 'a1111111-1111-4111-8111-11111111111a', 'manager', 'active');

insert into public.suppliers (
  id, restaurant_id, display_name, normalized_name
) values (
  'a0000000-0000-4000-8000-000000000033',
  'a0000000-0000-4000-8000-00000000000a',
  'Evidence Produce Co',
  'evidence produce co'
);

-- Use completed (not draft) so multiple same-supplier orders clear the
-- one-draft-per-supplier unique index while still satisfying the delivery FK.
insert into public.supplier_orders (
  id, restaurant_id, supplier_id, supplier_name, order_message, status
) values
  ('a0000000-0000-4000-8000-000000000201', 'a0000000-0000-4000-8000-00000000000a',
   'a0000000-0000-4000-8000-000000000033', 'Evidence Produce Co', 'order one', 'completed'),
  ('a0000000-0000-4000-8000-000000000202', 'a0000000-0000-4000-8000-00000000000a',
   'a0000000-0000-4000-8000-000000000033', 'Evidence Produce Co', 'order two', 'completed'),
  ('a0000000-0000-4000-8000-000000000203', 'a0000000-0000-4000-8000-00000000000a',
   'a0000000-0000-4000-8000-000000000033', 'Evidence Produce Co', 'order three', 'completed'),
  ('a0000000-0000-4000-8000-000000000204', 'a0000000-0000-4000-8000-00000000000a',
   'a0000000-0000-4000-8000-000000000033', 'Evidence Produce Co', 'order four', 'completed'),
  ('a0000000-0000-4000-8000-000000000205', 'a0000000-0000-4000-8000-00000000000a',
   'a0000000-0000-4000-8000-000000000033', 'Evidence Produce Co', 'order five', 'completed'),
  ('a0000000-0000-4000-8000-000000000206', 'a0000000-0000-4000-8000-00000000000a',
   'a0000000-0000-4000-8000-000000000033', 'Evidence Produce Co', 'order six', 'completed'),
  ('a0000000-0000-4000-8000-000000000207', 'a0000000-0000-4000-8000-00000000000a',
   'a0000000-0000-4000-8000-000000000033', 'Evidence Produce Co', 'order seven', 'completed');

select has_function(
  'private',
  'enforce_supplier_email_delivery_failure_evidence',
  'supplier email delivery failure evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into private.supplier_email_deliveries (
      restaurant_id, supplier_order_id, actor_user_id, idempotency_key,
      claim_token, status, rfc_message_id
    ) values (
      'a0000000-0000-4000-8000-00000000000a',
      'a0000000-0000-4000-8000-000000000201',
      'a1111111-1111-4111-8111-11111111111a',
      'a0000000-0000-4000-8000-000000000201',
      'a0000000-0000-4000-8000-000000000901',
      'failed', '<mise-failure-evidence-null@mise.test>'
    )
  $sql$),
  'Supplier email delivery failure evidence is required',
  'direct supplier_email_deliveries insert cannot mint failed status without last_error_code'
);

select is(
  pg_temp.error_of($sql$
    insert into private.supplier_email_deliveries (
      restaurant_id, supplier_order_id, actor_user_id, idempotency_key,
      claim_token, status, rfc_message_id, last_error_code
    ) values (
      'a0000000-0000-4000-8000-00000000000a',
      'a0000000-0000-4000-8000-000000000202',
      'a1111111-1111-4111-8111-11111111111a',
      'a0000000-0000-4000-8000-000000000202',
      'a0000000-0000-4000-8000-000000000902',
      'unknown', '<mise-failure-evidence-blank@mise.test>', '   '
    )
  $sql$),
  'Supplier email delivery failure evidence is required',
  'direct supplier_email_deliveries insert cannot mint unknown status with blank last_error_code'
);

select is(
  pg_temp.error_of($sql$
    insert into private.supplier_email_deliveries (
      restaurant_id, supplier_order_id, actor_user_id, idempotency_key,
      claim_token, status, rfc_message_id, last_error_code
    ) values (
      'a0000000-0000-4000-8000-00000000000a',
      'a0000000-0000-4000-8000-000000000203',
      'a1111111-1111-4111-8111-11111111111a',
      'a0000000-0000-4000-8000-000000000203',
      'a0000000-0000-4000-8000-000000000903',
      'failed', '<mise-failure-evidence-ok@mise.test>', 'provider_rejected'
    )
  $sql$),
  null,
  'direct supplier_email_deliveries insert with last_error_code remains allowed for failed status'
);

select is(
  pg_temp.error_of($sql$
    insert into private.supplier_email_deliveries (
      restaurant_id, supplier_order_id, actor_user_id, idempotency_key,
      claim_token, status, rfc_message_id, last_error_code
    ) values (
      'a0000000-0000-4000-8000-00000000000a',
      'a0000000-0000-4000-8000-000000000204',
      'a1111111-1111-4111-8111-11111111111a',
      'a0000000-0000-4000-8000-000000000204',
      'a0000000-0000-4000-8000-000000000904',
      'unknown', '<mise-failure-evidence-unknown-ok@mise.test>', 'legacy_unproven_claim'
    )
  $sql$),
  null,
  'direct supplier_email_deliveries insert with last_error_code remains allowed for unknown status'
);

select is(
  pg_temp.error_of($sql$
    insert into private.supplier_email_deliveries (
      restaurant_id, supplier_order_id, actor_user_id, idempotency_key,
      claim_token, status, rfc_message_id
    ) values (
      'a0000000-0000-4000-8000-00000000000a',
      'a0000000-0000-4000-8000-000000000205',
      'a1111111-1111-4111-8111-11111111111a',
      'a0000000-0000-4000-8000-000000000205',
      'a0000000-0000-4000-8000-000000000905',
      'sending', '<mise-failure-evidence-sending@mise.test>'
    )
  $sql$),
  null,
  'direct supplier_email_deliveries insert can open sending without failure evidence'
);

select is(
  pg_temp.error_of($sql$
    insert into private.supplier_email_deliveries (
      restaurant_id, supplier_order_id, actor_user_id, idempotency_key,
      claim_token, status, rfc_message_id,
      provider_message_id, provider_accepted_at
    ) values (
      'a0000000-0000-4000-8000-00000000000a',
      'a0000000-0000-4000-8000-000000000206',
      'a1111111-1111-4111-8111-11111111111a',
      'a0000000-0000-4000-8000-000000000206',
      'a0000000-0000-4000-8000-000000000906',
      'sent', '<mise-failure-evidence-sent@mise.test>',
      'provider-message-sent', now()
    )
  $sql$),
  null,
  'direct supplier_email_deliveries insert can mint sent status without failure evidence'
);

insert into private.supplier_email_deliveries (
  restaurant_id, supplier_order_id, actor_user_id, idempotency_key,
  claim_token, status, rfc_message_id
) values (
  'a0000000-0000-4000-8000-00000000000a',
  'a0000000-0000-4000-8000-000000000207',
  'a1111111-1111-4111-8111-11111111111a',
  'a0000000-0000-4000-8000-000000000207',
  'a0000000-0000-4000-8000-000000000911',
  'sending', '<mise-failure-evidence-update@mise.test>'
);

select is(
  pg_temp.error_of($sql$
    update private.supplier_email_deliveries
    set status = 'failed',
      last_error_code = 'provider_rejected',
      updated_at = now()
    where claim_token = 'a0000000-0000-4000-8000-000000000911'
      and status = 'sending'
  $sql$),
  null,
  'failure UPDATE with evidence remains allowed (INSERT-only tip)'
);

select is(
  pg_temp.error_of($sql$
    update private.supplier_email_deliveries
    set status = 'failed',
      updated_at = now()
    where claim_token = 'a0000000-0000-4000-8000-000000000905'
      and status = 'sending'
  $sql$),
  null,
  'failure UPDATE without last_error_code remains allowed (INSERT-only tip)'
);

select * from finish();
rollback;
