-- MISE-005GZ: public.operational_issues.related_entity_type CHECK must keep
-- its null-or-length(trim) 1..80 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept related_entity_type bytes the
-- restored C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_related_entity_type_check'
  ),
  'operational_issues_related_entity_type_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_related_entity_type_check'
  ),
  'length\(trim\(related_entity_type\)\) between 1 and 80',
  'operational_issues related_entity_type CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_related_entity_type_check'
  ),
  'related_entity_type collate "C" !~ ''[[:cntrl:]]''',
  'operational_issues related_entity_type CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('inventory_item' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable operational related_entity_type is accepted under COLLATE C'
);

select is(
  (E'inventory\titem' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in operational related_entity_type is rejected under COLLATE C'
);

select is(
  (E'inventory\nitem' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in operational related_entity_type is rejected under COLLATE C'
);

select is(
  (E'inventory\u0000item' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in operational related_entity_type is rejected under COLLATE C'
);

select is(
  (E'inventory\u007fitem' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in operational related_entity_type is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('inventory_item' collate "C" !~ '[[:cntrl:]]')
    and (E'inventory\titem' collate "C" ~ '[[:cntrl:]]')
    and (E'inventory\nitem' collate "C" ~ '[[:cntrl:]]')
    and (E'inventory\u007fitem' collate "C" ~ '[[:cntrl:]]'),
  true,
  'operational related_entity_type control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'inventory\titem'),
      ('inventory_item'),
      (E'inventory\nitem'),
      (E'inventory\u007fitem')
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
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_related_entity_type_check'
  ),
  'between 1 and 80',
  'operational_issues related_entity_type CHECK keeps original length window'
);

select * from finish();
rollback;
