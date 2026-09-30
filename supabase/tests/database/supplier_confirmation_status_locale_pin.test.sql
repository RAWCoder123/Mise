-- MISE-005DA: supplier_order_confirmations.confirmation_status CHECK must
-- keep the exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a confirmation-lifecycle identity the restored
-- C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_order_confirmations'::regclass
      and conname = 'supplier_order_confirmations_confirmation_status_check'
  ),
  'supplier_order_confirmations_confirmation_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_order_confirmations'::regclass
      and conname = 'supplier_order_confirmations_confirmation_status_check'
  ),
  'confirmation_status in \(''acknowledged'', ''changed'', ''rejected'', ''unverified''\)',
  'supplier_order_confirmations confirmation_status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_order_confirmations'::regclass
      and conname = 'supplier_order_confirmations_confirmation_status_check'
  ),
  'confirmation_status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'supplier_order_confirmations confirmation_status CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('acknowledged' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token acknowledged matches under COLLATE C'
);

select is(
  ('changed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token changed matches under COLLATE C'
);

select is(
  ('rejected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token rejected matches under COLLATE C'
);

select is(
  ('unverified' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token unverified matches under COLLATE C'
);

select is(
  ('has changed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced confirmation_status token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty confirmation_status token is rejected under COLLATE C'
);

select is(
  ('changed!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated confirmation_status token is rejected under COLLATE C'
);

select is(
  (E'chang\u00e9d' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII confirmation_status token is rejected under COLLATE C'
);

select is(
  ('acknowledged' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('changed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('rejected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('unverified' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted confirmation_status tokens match under COLLATE C'
);

select * from finish();
rollback;
