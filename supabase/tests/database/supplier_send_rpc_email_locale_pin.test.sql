-- MISE-005Q: build_supplier_send_content From/To/subject preflights must be
-- pinned to COLLATE "C" lower + [[:cntrl:]] / [[:space:]] so approve/claim
-- cannot fingerprint a mailbox the claimed-envelope CHECK would reject.
begin;
select plan(8);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'private'::regnamespace
      and proname = 'build_supplier_send_content'
      and pg_get_function_identity_arguments(oid) = 'uuid, uuid'
  ),
  'private.build_supplier_send_content(uuid, uuid) exists'
);

select matches(
  pg_get_functiondef('private.build_supplier_send_content(uuid, uuid)'::regprocedure),
  'lower\(\s*pg_catalog\.btrim\(connection\.sender_email\) collate "C"\s*\) collate "C"',
  'build From lower/btrim uses COLLATE C'
);

select matches(
  pg_get_functiondef('private.build_supplier_send_content(uuid, uuid)'::regprocedure),
  'lower\(\s*pg_catalog\.btrim\(recipient\.email\) collate "C"\s*\) collate "C"',
  'build To lower/btrim uses COLLATE C'
);

select matches(
  pg_get_functiondef('private.build_supplier_send_content(uuid, uuid)'::regprocedure),
  'canonical_from collate "C" ~ ''[[:cntrl:]]''',
  'build From cntrl fail-closed uses COLLATE C'
);

select matches(
  pg_get_functiondef('private.build_supplier_send_content(uuid, uuid)'::regprocedure),
  'canonical_to collate "C" ~ ''[[:cntrl:]]''',
  'build To cntrl fail-closed uses COLLATE C'
);

select matches(
  pg_get_functiondef('private.build_supplier_send_content(uuid, uuid)'::regprocedure),
  'canonical_from collate "C" !~ ''\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$''',
  'build From shape fail-closed uses COLLATE C [[:space:]]'
);

select matches(
  pg_get_functiondef('private.build_supplier_send_content(uuid, uuid)'::regprocedure),
  'canonical_to collate "C" !~ ''\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$''',
  'build To shape fail-closed uses COLLATE C [[:space:]]'
);

select matches(
  pg_get_functiondef('private.build_supplier_send_content(uuid, uuid)'::regprocedure),
  'canonical_subject collate "C" ~ ''[[:cntrl:]]''',
  'build subject cntrl fail-closed uses COLLATE C'
);

select * from finish();
rollback;
