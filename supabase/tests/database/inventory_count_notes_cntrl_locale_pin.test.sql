-- MISE-005EN: public.inventory_count_sessions.note and
-- public.inventory_count_lines.note CHECKs must keep their exact
-- char_length bounds and pin ASCII control rejection under COLLATE "C"
-- so dump/restore cannot accept count-note bytes the restored C-locale
-- gate would refuse.
begin;
select plan(16);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_count_sessions'::regclass
      and conname = 'inventory_count_sessions_note_check'
  ),
  'inventory_count_sessions_note_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_count_sessions'::regclass
      and conname = 'inventory_count_sessions_note_check'
  ),
  'char_length\(note\) <= 240',
  'inventory_count_sessions note CHECK keeps exact char_length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_count_sessions'::regclass
      and conname = 'inventory_count_sessions_note_check'
  ),
  'note is null',
  'inventory_count_sessions note CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_count_sessions'::regclass
      and conname = 'inventory_count_sessions_note_check'
  ),
  'note collate "C" !~ ''[[:cntrl:]]''',
  'inventory_count_sessions note CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_count_lines'::regclass
      and conname = 'inventory_count_lines_note_check'
  ),
  'inventory_count_lines_note_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_count_lines'::regclass
      and conname = 'inventory_count_lines_note_check'
  ),
  'char_length\(note\) <= 240',
  'inventory_count_lines note CHECK keeps exact char_length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_count_lines'::regclass
      and conname = 'inventory_count_lines_note_check'
  ),
  'note is null',
  'inventory_count_lines note CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_count_lines'::regclass
      and conname = 'inventory_count_lines_note_check'
  ),
  'note collate "C" !~ ''[[:cntrl:]]''',
  'inventory_count_lines note CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Walk-in cooler recount' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable inventory count note text is accepted under COLLATE C'
);

select is(
  (E'Walk-in\tcooler recount' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in inventory count note text is rejected under COLLATE C'
);

select is(
  (E'Walk-in\ncooler recount' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in inventory count note text is rejected under COLLATE C'
);

select is(
  (E'Walk-in\u007fcooler recount' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in inventory count note text is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Walk-in cooler recount' collate "C" !~ '[[:cntrl:]]')
    and (E'Walk-in\tcooler recount' collate "C" ~ '[[:cntrl:]]')
    and (E'Walk-in\u007fcooler recount' collate "C" ~ '[[:cntrl:]]'),
  true,
  'inventory count note control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Walk-in\tcooler recount'),
      ('Walk-in cooler recount'),
      (E'Walk-in\ncooler recount'),
      (E'Walk-in\u007fcooler recount')
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
    where conrelid = 'public.inventory_count_sessions'::regclass
      and conname = 'inventory_count_sessions_note_check'
  ),
  '<= 240',
  'inventory_count_sessions note CHECK keeps original length window'
);

select * from finish();
rollback;
