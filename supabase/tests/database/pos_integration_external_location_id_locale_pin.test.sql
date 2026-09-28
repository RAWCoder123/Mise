-- MISE-005BF: pos_integrations.external_location_id CHECK must reject
-- non-ASCII / control / spaced primary location ids under COLLATE "C" while
-- still allowing NULL (disconnected / not yet chosen), so restore cannot
-- accept identity bytes the sibling pos_locations ASCII gate would refuse
-- (and vice versa).
begin;
select plan(9);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pos_integrations'::regclass
      and conname = 'pos_integrations_external_location_id_check'
  ),
  'pos_integrations_external_location_id_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_integrations'::regclass
      and conname = 'pos_integrations_external_location_id_check'
  ),
  'external_location_id is null',
  'pos_integrations.external_location_id CHECK allows NULL'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_integrations'::regclass
      and conname = 'pos_integrations_external_location_id_check'
  ),
  'external_location_id collate "C" ~ ''\^\[A-Za-z0-9_-\]\{1,128\}\$''',
  'pos_integrations.external_location_id CHECK uses COLLATE C ASCII shape'
);

select is(
  (
    select pg_get_constraintdef(oid) not ilike '%length(external_location_id)%'
    from pg_constraint
    where conrelid = 'public.pos_integrations'::regclass
      and conname = 'pos_integrations_external_location_id_check'
  ),
  true,
  'pos_integrations.external_location_id CHECK is not length-only'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('LABCDEFG1234567' collate "C" ~ '^[A-Za-z0-9_-]{1,128}$'),
  true,
  'Square-style primary location id matches under COLLATE C'
);

select is(
  ('demo-location' collate "C" ~ '^[A-Za-z0-9_-]{1,128}$'),
  true,
  'fixture ASCII primary location id matches under COLLATE C'
);

select is(
  ('location with space' collate "C" ~ '^[A-Za-z0-9_-]{1,128}$'),
  false,
  'spaced primary external_location_id is rejected under COLLATE C'
);

select is(
  (E'location\twith-tab' collate "C" ~ '^[A-Za-z0-9_-]{1,128}$'),
  false,
  'ASCII tab primary external_location_id is rejected under COLLATE C'
);

select is(
  ('ubicación-ñ' collate "C" ~ '^[A-Za-z0-9_-]{1,128}$'),
  false,
  'non-ASCII primary external_location_id is rejected under COLLATE C'
);

select * from finish();
rollback;
