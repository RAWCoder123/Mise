-- MISE-005DU: supplier_email_deliveries.status CHECK must keep the
-- exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a delivery-status token the restored
-- C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_status_check'
  ),
  'supplier_email_deliveries_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_status_check'
  ),
  'status in \(''sending'', ''sent'', ''failed'', ''unknown''\)',
  'supplier_email_deliveries status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_status_check'
  ),
  'status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'supplier_email_deliveries status CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('sending' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token sending matches under COLLATE C'
);

select is(
  ('sent' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token sent matches under COLLATE C'
);

select is(
  ('failed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token failed matches under COLLATE C'
);

select is(
  ('unknown' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token unknown matches under COLLATE C'
);

select is(
  ('send unknown' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced status token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty status token is rejected under COLLATE C'
);

select is(
  ('sent!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated status token is rejected under COLLATE C'
);

select is(
  (E'sen\u00f0' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII status token is rejected under COLLATE C'
);

select is(
  ('sending' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('sent' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('failed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('unknown' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted status tokens match under COLLATE C'
);

select * from finish();
rollback;
