-- MISE-005IN: private.beta_restaurant_provisioning_requests name/cuisine
-- CHECKs must keep writer length bounds and pin ASCII control rejection
-- under COLLATE "C" so dump/restore cannot accept provisioning ledger
-- bytes the restored C-locale restaurants profile gates would refuse.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.beta_restaurant_provisioning_requests'::regclass
      and conname = 'beta_restaurant_provisioning_requests_name_check'
  ),
  'beta_restaurant_provisioning_requests_name_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.beta_restaurant_provisioning_requests'::regclass
      and conname = 'beta_restaurant_provisioning_requests_name_check'
  ),
  'length\(normalized_restaurant_name\) between 1 and 120',
  'beta provisioning name CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.beta_restaurant_provisioning_requests'::regclass
      and conname = 'beta_restaurant_provisioning_requests_name_check'
  ),
  'normalized_restaurant_name collate "C" !~ ''[[:cntrl:]]''',
  'beta provisioning name CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.beta_restaurant_provisioning_requests'::regclass
      and conname = 'beta_restaurant_provisioning_requests_cuisine_check'
  ),
  'beta_restaurant_provisioning_requests_cuisine_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.beta_restaurant_provisioning_requests'::regclass
      and conname = 'beta_restaurant_provisioning_requests_cuisine_check'
  ),
  'length\(normalized_cuisine_type\) <= 120',
  'beta provisioning cuisine CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.beta_restaurant_provisioning_requests'::regclass
      and conname = 'beta_restaurant_provisioning_requests_cuisine_check'
  ),
  'normalized_cuisine_type collate "C" !~ ''[[:cntrl:]]''',
  'beta provisioning cuisine CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Harbor Kitchen' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable provisioning name text is accepted under COLLATE C'
);

select is(
  (E'Harbor\tKitchen' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in provisioning name text is rejected under COLLATE C'
);

select is(
  (E'Harbor\nKitchen' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in provisioning name text is rejected under COLLATE C'
);

select is(
  (E'Harbor\u007fKitchen' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in provisioning name text is rejected under COLLATE C'
);

select is(
  ('Coastal' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable provisioning cuisine text is accepted under COLLATE C'
);

select is(
  (E'Coastal\t' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in provisioning cuisine text is rejected under COLLATE C'
);

select is(
  ('Harbor Kitchen' collate "C" !~ '[[:cntrl:]]')
    and (E'Harbor\tKitchen' collate "C" ~ '[[:cntrl:]]')
    and (E'Harbor\u007fKitchen' collate "C" ~ '[[:cntrl:]]'),
  true,
  'provisioning control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Harbor\tKitchen'),
      ('Harbor Kitchen'),
      (E'Harbor\nKitchen'),
      (E'Harbor\u007fKitchen')
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
