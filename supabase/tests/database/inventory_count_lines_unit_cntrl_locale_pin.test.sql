-- MISE-005GC: public.inventory_count_lines.unit CHECK must keep its
-- exact char_length(btrim) bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept unit bytes the restored
-- C-locale gate would refuse. item_name stays on its separate sibling
-- CHECK and is not rewritten by this tip.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_count_lines'::regclass
      and conname = 'inventory_count_lines_unit_check'
  ),
  'inventory_count_lines_unit_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_count_lines'::regclass
      and conname = 'inventory_count_lines_unit_check'
  ),
  'char_length\(btrim\(unit\)\) between 1 and 40',
  'inventory_count_lines unit CHECK keeps exact char_length(btrim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_count_lines'::regclass
      and conname = 'inventory_count_lines_unit_check'
  ),
  'unit collate "C" !~ ''[[:cntrl:]]''',
  'inventory_count_lines unit CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_count_lines'::regclass
      and conname = 'inventory_count_lines_item_name_check'
  ),
  'char_length\(btrim\(item_name\)\) between 1 and 160',
  'inventory_count_lines item_name CHECK keeps exact length bound on its sibling'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('lb' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable inventory count line unit is accepted under COLLATE C'
);

select is(
  (E'l\tb' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in inventory count line unit is rejected under COLLATE C'
);

select is(
  (E'l\nb' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in inventory count line unit is rejected under COLLATE C'
);

select is(
  (E'l\u007fb' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in inventory count line unit is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('lb' collate "C" !~ '[[:cntrl:]]')
    and (E'l\tb' collate "C" ~ '[[:cntrl:]]')
    and (E'l\u007fb' collate "C" ~ '[[:cntrl:]]'),
  true,
  'inventory count line unit control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'l\tb'),
      ('lb'),
      (E'l\nb'),
      (E'l\u007fb')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ '[[:cntrl:]]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ '[[:cntrl:]]')
  ),
  0::bigint,
  'ASCII control detector is identical under C and under the database ctype'
);

select ok(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_count_lines'::regclass
      and conname = 'inventory_count_lines_item_name_check'
  ) !~ 'unit',
  'inventory_count_lines item_name CHECK remains separate from unit on this tip'
);

select * from finish();
rollback;
