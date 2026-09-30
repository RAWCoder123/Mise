-- MISE-005DB: supplier_deliveries.status CHECK must keep the
-- exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a receiving-lifecycle identity the restored
-- C-locale gate would refuse.
begin;
select plan(13);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_deliveries'::regclass
      and conname = 'supplier_deliveries_status_check'
  ),
  'supplier_deliveries_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_deliveries'::regclass
      and conname = 'supplier_deliveries_status_check'
  ),
  'status in \(''unverified'', ''partially_received'', ''received'', ''discrepancy'', ''failed''\)',
  'supplier_deliveries status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_deliveries'::regclass
      and conname = 'supplier_deliveries_status_check'
  ),
  'status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'supplier_deliveries status CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('unverified' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token unverified matches under COLLATE C'
);

select is(
  ('partially_received' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token partially_received matches under COLLATE C'
);

select is(
  ('received' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token received matches under COLLATE C'
);

select is(
  ('discrepancy' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token discrepancy matches under COLLATE C'
);

select is(
  ('failed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token failed matches under COLLATE C'
);

select is(
  ('partially received' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced status token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty status token is rejected under COLLATE C'
);

select is(
  ('received!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated status token is rejected under COLLATE C'
);

select is(
  (E'receiv\u00e9d' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII status token is rejected under COLLATE C'
);

select is(
  ('unverified' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('partially_received' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('received' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('discrepancy' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('failed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted status tokens match under COLLATE C'
);

select * from finish();
rollback;
