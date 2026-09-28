-- MISE-005BT: supplier_email_deliveries content_version and
-- authority_version CHECKs must use COLLATE "C" so dump/restore cannot
-- accept a contract identity the restored ASCII C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_content_version_check'
  ),
  'supplier_email_deliveries_content_version_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_authority_version_check'
  ),
  'supplier_email_deliveries_authority_version_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_content_version_check'
  ),
  'content_version collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'content_version CHECK uses COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_authority_version_check'
  ),
  'authority_version collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'authority_version CHECK uses COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_content_version_check'
  ),
  'content_version is null',
  'content_version CHECK preserves nullable unclaimed state'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_authority_version_check'
  ),
  'authority_version is null',
  'authority_version CHECK preserves nullable unclaimed state'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('mise.supplier_send.v1' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer content_version mise.supplier_send.v1 matches under COLLATE C'
);

select is(
  ('mise.supplier_send.v2' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer content_version mise.supplier_send.v2 matches under COLLATE C'
);

select is(
  ('mise.purchase_authority.v1' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer authority_version mise.purchase_authority.v1 matches under COLLATE C'
);

select is(
  ('mise supplier send v1' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced supplier-send content_version is rejected under COLLATE C'
);

select is(
  ('mise purchase authority v1' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced purchase-authority version is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty supplier-send version token is rejected under COLLATE C'
);

select * from finish();
rollback;
