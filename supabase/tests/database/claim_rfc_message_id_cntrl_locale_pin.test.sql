-- MISE-005S: claim RFC Message-Id cntrl preflight must use COLLATE "C" so
-- claim cannot accept a Message-Id the deliveries CHECK would reject after
-- locale drift (and vice versa). Also preserves MISE-005R credential identity.
begin;
select plan(5);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'private'::regnamespace
      and proname = 'service_claim_supplier_email_send'
      and pg_get_function_identity_arguments(oid) = 'uuid, uuid, uuid, uuid, text'
  ),
  'private.service_claim_supplier_email_send(uuid, uuid, uuid, uuid, text) exists'
);

select matches(
  pg_get_functiondef(
    'private.service_claim_supplier_email_send(uuid, uuid, uuid, uuid, text)'::regprocedure
  ),
  'p_rfc_message_id collate "C" ~ ''\[\[:cntrl:\]\]''',
  'claim RFC Message-Id cntrl preflight uses COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.service_claim_supplier_email_send(uuid, uuid, uuid, uuid, text)'::regprocedure
  ),
  'credential\.sender_email <> pg_catalog\.lower\(\s*pg_catalog\.btrim\(connection\.sender_email\) collate "C"\s*\) collate "C"',
  'claim credential identity lower/btrim uses COLLATE C'
);

select is(
  has_function_privilege(
    'service_role',
    'private.service_claim_supplier_email_send(uuid, uuid, uuid, uuid, text)',
    'EXECUTE'
  ),
  true,
  'service_role retains EXECUTE on claim'
);

select is(
  has_function_privilege(
    'authenticated',
    'private.service_claim_supplier_email_send(uuid, uuid, uuid, uuid, text)',
    'EXECUTE'
  ),
  false,
  'authenticated lacks EXECUTE on claim'
);

select * from finish();
rollback;
