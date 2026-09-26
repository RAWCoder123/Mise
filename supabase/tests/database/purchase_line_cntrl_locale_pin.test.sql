-- MISE-005F: purchase_lines control-character CHECKs must be pinned to
-- COLLATE "C" so append-only restore cannot reject rows the source accepted.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_proc
    where proname = 'purchase_line_has_control_characters'
      and pronamespace = 'private'::regnamespace
  ),
  'private.purchase_line_has_control_characters exists'
);

select is(
  private.purchase_line_has_control_characters(E'INV-1\t'),
  true,
  'ASCII tab is a control under COLLATE C'
);

select is(
  private.purchase_line_has_control_characters('INV-1'),
  false,
  'printable ASCII is not a control under COLLATE C'
);

select is(
  private.purchase_line_has_control_characters(E'line\u007f'),
  true,
  'ASCII DEL is a control under COLLATE C'
);

select is(
  private.purchase_line_text(
    jsonb_build_object('rawItemDescription', E'Chicken\tThighs'),
    'rawItemDescription',
    500
  ),
  null,
  'purchase_line_text rejects ASCII control characters'
);

select is(
  private.purchase_line_text(
    jsonb_build_object('rawItemDescription', 'Chicken Thighs'),
    'rawItemDescription',
    500
  ),
  'Chicken Thighs',
  'purchase_line_text accepts printable text'
);

-- Compared as boolean identity across ctypes. Sibling proof lives on
-- normalize_purchase_item_key (MISE-005A).
select is(
  (select count(*) from (values
     (E'INV\t1'), ('INV-1'), (E'pack\nsize'), ('40 LB'), (E'unit\u007f')
   ) fixture(sample)
   where private.purchase_line_has_control_characters(fixture.sample collate "C")
     is distinct from
     private.purchase_line_has_control_characters(fixture.sample collate "en_US.utf8")),
  0::bigint,
  'control detector is identical under C and under the database ctype'
);

select ok(
  (
    select count(*) = 0
    from (
      values
        ('purchase_lines_source_document_reference_check'),
        ('purchase_lines_raw_item_description_check'),
        ('purchase_lines_unit_of_measure_check'),
        ('purchase_lines_pack_size_check')
    ) as targets(name)
    join pg_constraint constraint_row
      on constraint_row.conrelid = 'public.purchase_lines'::regclass
     and constraint_row.conname = targets.name
    where pg_get_constraintdef(constraint_row.oid) !~* 'collate "C"'
       or pg_get_constraintdef(constraint_row.oid) !~ '\[\[:cntrl:\]\]'
  ),
  'every purchase_lines text cntrl CHECK is pinned to COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_source_document_reference_check'
  ),
  'source_document_reference collate "C" !~ ''[[:cntrl:]]''',
  'source_document_reference CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_raw_item_description_check'
  ),
  'raw_item_description collate "C" !~ ''[[:cntrl:]]''',
  'raw_item_description CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_unit_of_measure_check'
  ),
  'unit_of_measure collate "C" !~ ''[[:cntrl:]]''',
  'unit_of_measure CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_pack_size_check'
  ),
  'pack_size collate "C" !~ ''[[:cntrl:]]''',
  'pack_size CHECK uses COLLATE C cntrl rejection'
);

select * from finish();
rollback;
