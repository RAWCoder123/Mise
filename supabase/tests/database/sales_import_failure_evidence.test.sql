create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' sales_import_failure_evidence.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(8);

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
   'authenticated', 'authenticated', 'sales-import-failure-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('a0000000-0000-4000-8000-00000000000a', 'Sales Import Failure Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('a0000000-0000-4000-8000-00000000000a', 'a1111111-1111-4111-8111-11111111111a', 'manager', 'active');

insert into public.pos_integrations (
  id, restaurant_id, provider, status
) values (
  'a0000000-0000-4000-8000-000000000044',
  'a0000000-0000-4000-8000-00000000000a',
  'square',
  'connected'
);

select has_function(
  'private',
  'enforce_sales_import_failure_evidence',
  'sales import failure evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.sales_imports (
      restaurant_id, pos_integration_id, import_type, status, records_processed
    ) values (
      'a0000000-0000-4000-8000-00000000000a',
      'a0000000-0000-4000-8000-000000000044',
      'pos_sync', 'failed', 0
    )
  $sql$),
  'Sales import failure evidence is required',
  'direct sales_imports insert cannot mint failed status without error_message'
);

select is(
  pg_temp.error_of($sql$
    insert into public.sales_imports (
      restaurant_id, pos_integration_id, import_type, status,
      records_processed, error_message
    ) values (
      'a0000000-0000-4000-8000-00000000000a',
      'a0000000-0000-4000-8000-000000000044',
      'pos_sync', 'failed', 0, '   '
    )
  $sql$),
  'Sales import failure evidence is required',
  'direct sales_imports insert cannot mint failed status with blank error_message'
);

select is(
  pg_temp.error_of($sql$
    insert into public.sales_imports (
      id, restaurant_id, pos_integration_id, import_type, status,
      records_processed, error_message
    ) values (
      'a0000000-0000-4000-8000-0000000000aa',
      'a0000000-0000-4000-8000-00000000000a',
      'a0000000-0000-4000-8000-000000000044',
      'pos_sync', 'failed', 0,
      'square_token_expired'
    )
  $sql$),
  null,
  'direct sales_imports insert with error_message remains allowed for failed status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.sales_imports (
      id, restaurant_id, pos_integration_id, import_type, status, records_processed
    ) values (
      'a0000000-0000-4000-8000-0000000000ab',
      'a0000000-0000-4000-8000-00000000000a',
      'a0000000-0000-4000-8000-000000000044',
      'pos_sync', 'processing', 0
    )
  $sql$),
  null,
  'direct sales_imports insert can open processing without failure evidence'
);

select is(
  pg_temp.error_of($sql$
    insert into public.sales_imports (
      id, restaurant_id, pos_integration_id, import_type, status, records_processed
    ) values (
      'a0000000-0000-4000-8000-0000000000ac',
      'a0000000-0000-4000-8000-00000000000a',
      'a0000000-0000-4000-8000-000000000044',
      'pos_sync', 'completed', 4
    )
  $sql$),
  null,
  'direct sales_imports insert can mint completed status without failure evidence'
);

select is(
  pg_temp.error_of($sql$
    insert into public.sales_imports (
      id, restaurant_id, pos_integration_id, import_type, status, records_processed
    ) values (
      'a0000000-0000-4000-8000-0000000000ad',
      'a0000000-0000-4000-8000-00000000000a',
      'a0000000-0000-4000-8000-000000000044',
      'csv_upload', 'queued', 0
    )
  $sql$),
  null,
  'direct sales_imports insert can mint queued status without failure evidence'
);

insert into public.sales_imports (
  id, restaurant_id, pos_integration_id, import_type, status, records_processed
) values (
  'a0000000-0000-4000-8000-0000000000ae',
  'a0000000-0000-4000-8000-00000000000a',
  'a0000000-0000-4000-8000-000000000044',
  'pos_sync', 'processing', 0
);

select is(
  pg_temp.error_of($sql$
    update public.sales_imports
    set status = 'failed',
      error_message = 'square_sync_unavailable',
      records_processed = 0
    where id = 'a0000000-0000-4000-8000-0000000000ae'
      and status = 'processing'
  $sql$),
  null,
  'failure UPDATE with evidence remains allowed (INSERT-only tip)'
);

select * from finish();
rollback;
