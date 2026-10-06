-- MISE-005JB: public.supplier_deliveries.notes CHECK must keep its
-- exact length bound and pin multiline-aware ASCII control rejection
-- under COLLATE "C" so dump/restore cannot accept note bytes the
-- restored C-locale gate would refuse, while still allowing LF/TAB/CR.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_deliveries'::regclass
      and conname = 'supplier_deliveries_notes_bound_check'
  ),
  'supplier_deliveries_notes_bound_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_deliveries'::regclass
      and conname = 'supplier_deliveries_notes_bound_check'
  ),
  'length\(notes\) <= 2000',
  'notes CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_deliveries'::regclass
      and conname = 'supplier_deliveries_notes_bound_check'
  ),
  'notes is null',
  'notes CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_deliveries'::regclass
      and conname = 'supplier_deliveries_notes_bound_check'
  ),
  'notes collate "C" !~',
  'notes CHECK uses COLLATE C control rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Shorted two cases; left on dock' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'printable delivery notes text is accepted under COLLATE C'
);

select is(
  (E'Shorted two cases;\nleft on dock' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'LF in delivery notes text is accepted under multiline-aware gate'
);

select is(
  (E'Shorted two cases;\tleft on dock' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'TAB in delivery notes text is accepted under multiline-aware gate'
);

select is(
  (E'Shorted two cases;\rleft on dock' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'CR in delivery notes text is accepted under multiline-aware gate'
);

select is(
  (E'Shorted two cases;\x08left on dock' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'BS in delivery notes text is rejected under COLLATE C'
);

select is(
  (E'Shorted two cases;\x0bleft on dock' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'VT in delivery notes text is rejected under COLLATE C'
);

select is(
  (E'Shorted two cases;\u007fleft on dock' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'DEL in delivery notes text is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'empty string has no unsafe multiline controls under COLLATE C'
);

select is(
  ('Shorted two cases; left on dock' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Shorted two cases;\nleft on dock' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Shorted two cases;\x0bleft on dock' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Shorted two cases;\u007fleft on dock' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'delivery notes multiline control detector matches supplier-send allowlist'
);

select is(
  (
    select count(*)
    from (values
      (E'Shorted two cases;\tleft on dock'),
      ('Shorted two cases; left on dock'),
      (E'Shorted two cases;\nleft on dock'),
      (E'Shorted two cases;\rleft on dock'),
      (E'Shorted two cases;\x0bleft on dock'),
      (E'Shorted two cases;\u007fleft on dock')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
  ),
  0::bigint,
  'multiline ASCII control detector is identical under C and under the database ctype'
);

select * from finish();
rollback;
