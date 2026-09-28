-- MISE-005BN: sales_imports.source_file_name CHECK must reject control
-- characters under COLLATE "C" while preserving the nullable length(trim)
-- 1–260 bound, so restore cannot accept filename bytes a restored C-locale
-- gate would refuse (and vice versa).
begin;
select plan(8);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sales_imports'::regclass
      and conname = 'sales_imports_source_file_name_check'
  ),
  'sales_imports_source_file_name_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.sales_imports'::regclass
      and conname = 'sales_imports_source_file_name_check'
  ),
  'source_file_name is null',
  'sales_imports.source_file_name CHECK allows NULL'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.sales_imports'::regclass
      and conname = 'sales_imports_source_file_name_check'
  ),
  'source_file_name collate "C" !~ ''[[:cntrl:]]''',
  'sales_imports.source_file_name CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.sales_imports'::regclass
      and conname = 'sales_imports_source_file_name_check'
  ),
  'length\(trim\(source_file_name\)\) between 1 and 260',
  'sales_imports.source_file_name CHECK preserves length(trim) 1–260 bound'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  (E'sales\tweek.csv' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII tab is a control under COLLATE C'
);

select is(
  ('square-sales-2026-09-28.csv' collate "C" ~ '[[:cntrl:]]'),
  false,
  'printable ASCII source file name is not a control under COLLATE C'
);

select is(
  (E'sales\u007fweek.csv' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII DEL is a control under COLLATE C'
);

select is(
  ((repeat('a', 256) || '.csv') collate "C" ~ '[[:cntrl:]]'),
  false,
  'max-length printable ASCII source file name is not a control under COLLATE C'
);

select * from finish();
rollback;
