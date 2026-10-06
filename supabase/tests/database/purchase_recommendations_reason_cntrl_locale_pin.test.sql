-- MISE-005IT: public.purchase_recommendations.reason CHECK must keep
-- its exact length bound and pin multiline-aware ASCII control rejection
-- under COLLATE "C" so dump/restore cannot accept reason bytes the restored
-- C-locale gate would refuse. Preserves the MISE-005FX item_name,
-- MISE-005FY supplier_name, and MISE-005FZ unit cntrl pins on the shared
-- operational_values_check. Allows LF/TAB/CR; rejects other C0 controls
-- and DEL (same class as operator_note / supplier-send multiline).
begin;
select plan(18);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_recommendations'::regclass
      and conname = 'purchase_recommendations_operational_values_check'
  ),
  'purchase_recommendations_operational_values_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_recommendations'::regclass
      and conname = 'purchase_recommendations_operational_values_check'
  ),
  'length\(trim\(reason\)\) between 1 and 2000',
  'purchase_recommendations reason CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_recommendations'::regclass
      and conname = 'purchase_recommendations_operational_values_check'
  ),
  'reason collate "C" !~',
  'purchase_recommendations reason CHECK uses COLLATE C multiline-aware cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_recommendations'::regclass
      and conname = 'purchase_recommendations_operational_values_check'
  ),
  'item_name collate "C" !~ ''[[:cntrl:]]''',
  'purchase_recommendations item_name CHECK keeps MISE-005FX cntrl pin'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_recommendations'::regclass
      and conname = 'purchase_recommendations_operational_values_check'
  ),
  'supplier_name collate "C" !~ ''[[:cntrl:]]''',
  'purchase_recommendations supplier_name CHECK keeps MISE-005FY cntrl pin'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_recommendations'::regclass
      and conname = 'purchase_recommendations_operational_values_check'
  ),
  'unit collate "C" !~ ''[[:cntrl:]]''',
  'purchase_recommendations unit CHECK keeps MISE-005FZ cntrl pin'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_recommendations'::regclass
      and conname = 'purchase_recommendations_operational_values_check'
  ),
  'length\(trim\(item_name\)\) between 1 and 160',
  'purchase_recommendations item_name CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_recommendations'::regclass
      and conname = 'purchase_recommendations_operational_values_check'
  ),
  'length\(trim\(supplier_name\)\) between 1 and 160',
  'purchase_recommendations supplier_name CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_recommendations'::regclass
      and conname = 'purchase_recommendations_operational_values_check'
  ),
  'length\(trim\(unit\)\) between 1 and 40',
  'purchase_recommendations unit CHECK keeps exact length bound'
);

-- Multiline-aware detector: printable and LF/TAB/CR accepted; BS/VT/DEL rejected.
select is(
  ('Par low; order before Friday service.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'printable purchase recommendation reason is accepted under COLLATE C'
);

select is(
  (E'Par low.\nOrder before Friday.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'LF in purchase recommendation reason is accepted under COLLATE C'
);

select is(
  (E'Par low.\tOrder before Friday.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'TAB in purchase recommendation reason is accepted under COLLATE C'
);

select is(
  (E'Par low.\rOrder before Friday.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'CR in purchase recommendation reason is accepted under COLLATE C'
);

select is(
  (E'Par low.\x08Order' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'BS in purchase recommendation reason is rejected under COLLATE C'
);

select is(
  (E'Par low.\x0bOrder' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'VT in purchase recommendation reason is rejected under COLLATE C'
);

select is(
  (E'Par low.\u007fOrder' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'DEL in purchase recommendation reason is rejected under COLLATE C'
);

select is(
  ('Par low; order before Friday service.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Par low.\nOrder' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Par low.\x0bOrder' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Par low.\u007fOrder' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'purchase recommendation reason control detector matches multiline-aware ASCII class'
);

select is(
  (
    select count(*)
    from (values
      (E'Par low.\nOrder'),
      ('Par low; order before Friday service.'),
      (E'Par low.\x08Order'),
      (E'Par low.\u007fOrder')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
  ),
  0::bigint,
  'ASCII multiline control detector is identical under C and under the database ctype'
);

select * from finish();
rollback;
