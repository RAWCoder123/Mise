-- MISE-005IJ: public.setup_attachments.label CHECK must keep the
-- metadata_only storage_status contract, align label length with the
-- save_restaurant_setup writer (1..240 after trim), and pin ASCII control
-- rejection under COLLATE "C" so dump/restore cannot accept label bytes the
-- restored C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.setup_attachments'::regclass
      and conname = 'setup_attachments_metadata_only_check'
  ),
  'setup_attachments_metadata_only_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.setup_attachments'::regclass
      and conname = 'setup_attachments_metadata_only_check'
  ),
  'length\(trim\(label\)\) between 1 and 240',
  'setup_attachments label CHECK keeps writer-aligned length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.setup_attachments'::regclass
      and conname = 'setup_attachments_metadata_only_check'
  ),
  'label collate "C" !~ ''[[:cntrl:]]''',
  'setup_attachments label CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.setup_attachments'::regclass
      and conname = 'setup_attachments_metadata_only_check'
  ),
  'metadata_only',
  'setup_attachments metadata_only storage_status contract is preserved'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Weekly CSV' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable setup attachment label is accepted under COLLATE C'
);

select is(
  (E'Weekly\tCSV' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in setup attachment label is rejected under COLLATE C'
);

select is(
  (E'Weekly\nCSV' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in setup attachment label is rejected under COLLATE C'
);

select is(
  (E'Weekly\u0000CSV' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in setup attachment label is rejected under COLLATE C'
);

select is(
  (E'Weekly\u007fCSV' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in setup attachment label is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Weekly CSV' collate "C" !~ '[[:cntrl:]]')
    and (E'Weekly\tCSV' collate "C" ~ '[[:cntrl:]]')
    and (E'Weekly\nCSV' collate "C" ~ '[[:cntrl:]]')
    and (E'Weekly\u007fCSV' collate "C" ~ '[[:cntrl:]]'),
  true,
  'setup attachment label control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Weekly\tCSV'),
      ('Weekly CSV'),
      (E'Weekly\nCSV'),
      (E'Weekly\u007fCSV')
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
