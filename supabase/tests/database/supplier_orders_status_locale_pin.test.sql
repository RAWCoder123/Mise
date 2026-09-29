-- MISE-005CK: supplier_orders.status CHECK must keep the
-- exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept an order-lifecycle identity the restored
-- C-locale gate would refuse.
begin;
select plan(11);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_orders'::regclass
      and conname = 'supplier_orders_status_check'
  ),
  'supplier_orders_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_orders'::regclass
      and conname = 'supplier_orders_status_check'
  ),
  'status in \(''draft'', ''sent'', ''completed''\)',
  'supplier_orders status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_orders'::regclass
      and conname = 'supplier_orders_status_check'
  ),
  'status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'supplier_orders status CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('draft' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token draft matches under COLLATE C'
);

select is(
  ('sent' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token sent matches under COLLATE C'
);

select is(
  ('completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token completed matches under COLLATE C'
);

select is(
  ('has sent' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
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
  (E's\u00e9nt' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII status token is rejected under COLLATE C'
);

select is(
  ('draft' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('sent' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted status tokens match under COLLATE C'
);

select * from finish();
rollback;
