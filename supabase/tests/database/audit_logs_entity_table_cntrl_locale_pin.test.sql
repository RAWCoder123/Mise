-- MISE-005FT: public.audit_logs.entity_table CHECK must keep its
-- length(trim) 1..120 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept entity_table bytes the
-- restored C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.audit_logs'::regclass
      and conname = 'audit_logs_entity_table_check'
  ),
  'audit_logs_entity_table_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.audit_logs'::regclass
      and conname = 'audit_logs_entity_table_check'
  ),
  'length\(trim\(entity_table\)\) between 1 and 120',
  'audit_logs entity_table CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.audit_logs'::regclass
      and conname = 'audit_logs_entity_table_check'
  ),
  'entity_table collate "C" !~ ''[[:cntrl:]]''',
  'audit_logs entity_table CHECK uses COLLATE C cntrl rejection'
);

select ok(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.audit_logs'::regclass
      and conname = 'audit_logs_entity_table_check'
  ) not ilike '%action%',
  'audit_logs entity_table CHECK does not bind action'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('purchase_recommendations' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable audit_logs entity_table is accepted under COLLATE C'
);

select is(
  (E'purchase\trecommendations' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in audit_logs entity_table is rejected under COLLATE C'
);

select is(
  (E'purchase\nrecommendations' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in audit_logs entity_table is rejected under COLLATE C'
);

select is(
  (E'purchase\u0000recommendations' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in audit_logs entity_table is rejected under COLLATE C'
);

select is(
  (E'purchase\u007frecommendations' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in audit_logs entity_table is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('purchase_recommendations' collate "C" !~ '[[:cntrl:]]')
    and (E'purchase\trecommendations' collate "C" ~ '[[:cntrl:]]')
    and (E'purchase\nrecommendations' collate "C" ~ '[[:cntrl:]]')
    and (E'purchase\u007frecommendations' collate "C" ~ '[[:cntrl:]]'),
  true,
  'audit_logs entity_table control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'purchase\trecommendations'),
      ('purchase_recommendations'),
      (E'purchase\nrecommendations'),
      (E'purchase\u007frecommendations')
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
