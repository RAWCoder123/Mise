-- MISE-005HI: private.edge_function_security_events.action CHECK must keep
-- its length(trim) 1..160 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept action bytes the restored
-- C-locale gate would refuse. Sibling function_name / event_type CHECKs
-- stay on separate constraints.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.edge_function_security_events'::regclass
      and conname = 'edge_function_security_events_action_check'
  ),
  'edge_function_security_events_action_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.edge_function_security_events'::regclass
      and conname = 'edge_function_security_events_action_check'
  ),
  'length\(trim\(action\)\) between 1 and 160',
  'edge action CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.edge_function_security_events'::regclass
      and conname = 'edge_function_security_events_action_check'
  ),
  'action collate "C" !~ ''[[:cntrl:]]''',
  'edge action CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.edge_function_security_events'::regclass
      and contype = 'c'
      and (
        conname = 'edge_function_security_events_function_name_check'
        or (
          pg_get_constraintdef(oid) ilike '%function_name%'
          and pg_get_constraintdef(oid) not ilike '%action%'
        )
      )
  ),
  'edge function_name CHECK remains attachable'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.edge_function_security_events'::regclass
      and contype = 'c'
      and conname = 'edge_function_security_events_action_check'
    limit 1
  ) ilike '%event_type%',
  false,
  'action CHECK stays dedicated (excludes event_type)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('supplier_email_blocked' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable edge action is accepted under COLLATE C'
);

select is(
  (E'supplier\temail' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in edge action is rejected under COLLATE C'
);

select is(
  (E'supplier\nemail' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in edge action is rejected under COLLATE C'
);

select is(
  (E'supplier\u007femail' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in edge action is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('supplier_email_blocked' collate "C" !~ '[[:cntrl:]]')
    and (E'supplier\temail' collate "C" ~ '[[:cntrl:]]')
    and (E'supplier\nemail' collate "C" ~ '[[:cntrl:]]')
    and (E'supplier\u007femail' collate "C" ~ '[[:cntrl:]]'),
  true,
  'edge action control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'supplier\temail'),
      ('supplier_email_blocked'),
      (E'supplier\nemail'),
      (E'supplier\u007femail')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ '[[:cntrl:]]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ '[[:cntrl:]]')
  ),
  0::bigint,
  'ASCII control detector is identical under C and under the database ctype'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.edge_function_security_events'::regclass
      and conname = 'edge_function_security_events_action_check'
  ),
  'between 1 and 160',
  'edge action CHECK keeps writer length window'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'private.edge_function_security_events'::regclass
      and contype = 'c'
      and conname = 'edge_function_security_events_action_check'
  ),
  1::bigint,
  'exactly one action_check constraint is attached'
);

select * from finish();
rollback;
