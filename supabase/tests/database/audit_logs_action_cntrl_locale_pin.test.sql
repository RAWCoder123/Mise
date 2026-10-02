-- MISE-005FS: public.audit_logs.action CHECK must keep its
-- length(trim) 1..120 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept action bytes the
-- restored C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.audit_logs'::regclass
      and conname = 'audit_logs_action_check'
  ),
  'audit_logs_action_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.audit_logs'::regclass
      and conname = 'audit_logs_action_check'
  ),
  'length\(trim\(action\)\) between 1 and 120',
  'audit_logs action CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.audit_logs'::regclass
      and conname = 'audit_logs_action_check'
  ),
  'action collate "C" !~ ''[[:cntrl:]]''',
  'audit_logs action CHECK uses COLLATE C cntrl rejection'
);

select ok(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.audit_logs'::regclass
      and conname = 'audit_logs_action_check'
  ) not ilike '%entity_table%',
  'audit_logs action CHECK does not bind entity_table'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('square_sync_completed' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable audit_logs action is accepted under COLLATE C'
);

select is(
  (E'square\tsync_completed' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in audit_logs action is rejected under COLLATE C'
);

select is(
  (E'square\nsync_completed' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in audit_logs action is rejected under COLLATE C'
);

select is(
  (E'square\u0000sync_completed' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in audit_logs action is rejected under COLLATE C'
);

select is(
  (E'square\u007fsync_completed' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in audit_logs action is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('square_sync_completed' collate "C" !~ '[[:cntrl:]]')
    and (E'square\tsync_completed' collate "C" ~ '[[:cntrl:]]')
    and (E'square\nsync_completed' collate "C" ~ '[[:cntrl:]]')
    and (E'square\u007fsync_completed' collate "C" ~ '[[:cntrl:]]'),
  true,
  'audit_logs action control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'square\tsync_completed'),
      ('square_sync_completed'),
      (E'square\nsync_completed'),
      (E'square\u007fsync_completed')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ '[[:cntrl:]]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ '[[:cntrl:]]')
  ),
  0::bigint,
  'ASCII control detector is identical under C and under the database ctype'
);

select * from finish();
rollback;
