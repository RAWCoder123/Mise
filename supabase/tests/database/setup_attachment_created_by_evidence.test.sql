create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' setup_attachment_created_by_evidence.test.sql
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
  ('c1111111-1111-4111-8111-11111111111c', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'setup-attachment-created-by-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('c0000000-0000-4000-8000-00000000000c', 'Setup Attachment Created-By Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('c0000000-0000-4000-8000-00000000000c', 'c1111111-1111-4111-8111-11111111111c', 'manager', 'active');

select has_function(
  'private',
  'enforce_setup_attachment_created_by_evidence',
  'setup attachment created_by evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.setup_attachments (
      restaurant_id, kind, label, status, metadata, created_by
    ) values (
      'c0000000-0000-4000-8000-00000000000c',
      'csv', 'Unattributable inventory CSV', 'queued',
      '{"storage_status":"metadata_only"}'::jsonb, null
    )
  $sql$),
  'Setup attachment creator is required',
  'direct setup_attachments insert cannot mint an unattributable null created_by'
);

select is(
  pg_temp.error_of($sql$
    insert into public.setup_attachments (
      id, restaurant_id, kind, label, status, metadata, created_by
    ) values (
      'c0000000-0000-4000-8000-0000000000cc',
      'c0000000-0000-4000-8000-00000000000c',
      'screenshot', 'Walk-in cooler screenshot', 'review_needed',
      '{"storage_status":"metadata_only","client_reference_id":"direct-ref-1"}'::jsonb,
      'c1111111-1111-4111-8111-11111111111c'
    )
  $sql$),
  null,
  'direct setup_attachments insert with a real created_by remains allowed'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1111111-1111-4111-8111-11111111111c', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.save_restaurant_setup(
      'c0000000-0000-4000-8000-00000000000c',
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      jsonb_build_array(jsonb_build_object(
        'client_reference_id', 'hosted-attach-ref-1',
        'kind', 'csv',
        'label', 'Hosted inventory CSV',
        'status', 'queued'
      )),
      0
    )
  $sql$),
  null,
  'hosted save_restaurant_setup can still insert with an attributed creator'
);

select is(
  (
    select created_by
    from public.setup_attachments
    where restaurant_id = 'c0000000-0000-4000-8000-00000000000c'
      and metadata->>'client_reference_id' = 'hosted-attach-ref-1'
  ),
  'c1111111-1111-4111-8111-11111111111c'::uuid,
  'accepted save_restaurant_setup keeps the authenticated created_by'
);

reset role;

select is(
  pg_temp.error_of($sql$
    delete from auth.users
    where id = 'c1111111-1111-4111-8111-11111111111c'
  $sql$),
  null,
  'account deletion remains allowed after setup_attachments history exists'
);

select is(
  (
    select count(*)
    from public.setup_attachments
    where restaurant_id = 'c0000000-0000-4000-8000-00000000000c'
      and id = 'c0000000-0000-4000-8000-0000000000cc'
      and created_by is null
      and kind = 'screenshot'
  ),
  1::bigint,
  'account deletion anonymizes setup-attachment creators without rewriting business fields'
);

select is(
  (
    select count(*)
    from public.setup_attachments
    where restaurant_id = 'c0000000-0000-4000-8000-00000000000c'
      and id = 'c0000000-0000-4000-8000-0000000000cc'
      and kind = 'screenshot'
      and label = 'Walk-in cooler screenshot'
      and status = 'review_needed'
  ),
  1::bigint,
  'account deletion preserves immutable setup_attachments business fields'
);

select * from finish();
rollback;
