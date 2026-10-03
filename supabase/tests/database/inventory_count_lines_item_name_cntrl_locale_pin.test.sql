-- MISE-005GB: public.inventory_count_lines.item_name CHECK must keep its
-- exact char_length(btrim) bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept item_name bytes the restored
-- C-locale gate would refuse. Unit remains length-only on its sibling
-- CHECK.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_count_lines'::regclass
      and conname = 'inventory_count_lines_item_name_check'
  ),
  'inventory_count_lines_item_name_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_count_lines'::regclass
      and conname = 'inventory_count_lines_item_name_check'
  ),
  'char_length\(btrim\(item_name\)\) between 1 and 160',
  'inventory_count_lines item_name CHECK keeps exact char_length(btrim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_count_lines'::regclass
      and conname = 'inventory_count_lines_item_name_check'
  ),
  'item_name collate "C" !~ ''[[:cntrl:]]''',
  'inventory_count_lines item_name CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_count_lines'::regclass
      and conname = 'inventory_count_lines_unit_check'
  ),
  'char_length\(btrim\(unit\)\) between 1 and 40',
  'inventory_count_lines unit CHECK keeps exact length bound without cntrl pin'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Chicken breast' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable inventory count line item_name is accepted under COLLATE C'
);

select is(
  (E'Chicken\tbreast' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in inventory count line item_name is rejected under COLLATE C'
);

select is(
  (E'Chicken\nbreast' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in inventory count line item_name is rejected under COLLATE C'
);

select is(
  (E'Chicken\u007fbreast' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in inventory count line item_name is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Chicken breast' collate "C" !~ '[[:cntrl:]]')
    and (E'Chicken\tbreast' collate "C" ~ '[[:cntrl:]]')
    and (E'Chicken\u007fbreast' collate "C" ~ '[[:cntrl:]]'),
  true,
  'inventory count line item_name control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Chicken\tbreast'),
      ('Chicken breast'),
      (E'Chicken\nbreast'),
      (E'Chicken\u007fbreast')
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
      and conname = 'inventory_count_lines_unit_check'
  ) !~ 'unit collate "C"',
  'inventory_count_lines unit CHECK remains without cntrl pin on this tip'
);

select * from finish();
rollback;
