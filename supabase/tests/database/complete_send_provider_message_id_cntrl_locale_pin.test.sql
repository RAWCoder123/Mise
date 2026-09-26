-- MISE-005T: complete-send provider_message_id cntrl preflight must use
-- COLLATE "C" so complete cannot accept a provider id a restored C-locale
-- gate would reject after locale drift (and vice versa).
begin;
select plan(4);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'private'::regnamespace
      and proname = 'service_complete_supplier_email_send'
      and pg_get_function_identity_arguments(oid) = 'uuid, uuid, uuid, uuid, text'
  ),
  'private.service_complete_supplier_email_send(uuid, uuid, uuid, uuid, text) exists'
);

select matches(
  pg_get_functiondef(
    'private.service_complete_supplier_email_send(uuid, uuid, uuid, uuid, text)'::regprocedure
  ),
  'p_provider_message_id collate "C" ~ ''\[\[:cntrl:\]\]''',
  'complete-send provider_message_id cntrl preflight uses COLLATE C'
);

select is(
  has_function_privilege(
    'service_role',
    'private.service_complete_supplier_email_send(uuid, uuid, uuid, uuid, text)',
    'EXECUTE'
  ),
  true,
  'service_role retains EXECUTE on complete-send'
);

select is(
  has_function_privilege(
    'authenticated',
    'private.service_complete_supplier_email_send(uuid, uuid, uuid, uuid, text)',
    'EXECUTE'
  ),
  false,
  'authenticated lacks EXECUTE on complete-send'
);

select * from finish();
rollback;
