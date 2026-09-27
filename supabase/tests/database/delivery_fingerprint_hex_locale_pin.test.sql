-- MISE-005AM: supplier_email_deliveries content/authority fingerprint hex
-- CHECKs must use COLLATE "C" so dump/restore cannot accept fingerprint
-- bytes the OAuth-sibling hex contract (MISE-005AD) and approve continuity
-- would refuse under C locale.
begin;
select plan(8);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_content_fingerprint_hex_check'
  ),
  'supplier_email_deliveries_content_fingerprint_hex_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_authority_fingerprint_hex_check'
  ),
  'supplier_email_deliveries_authority_fingerprint_hex_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_content_fingerprint_hex_check'
  ),
  'content_fingerprint collate "C" ~ ''\^\[a-f0-9\]\{64\}\$''',
  'content_fingerprint hex CHECK uses COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_authority_fingerprint_hex_check'
  ),
  'authority_fingerprint collate "C" ~ ''\^\[a-f0-9\]\{64\}\$''',
  'authority_fingerprint hex CHECK uses COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_content_fingerprint_hex_check'
  ),
  'content_fingerprint is null',
  'content_fingerprint hex CHECK preserves nullable unclaimed state'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_authority_fingerprint_hex_check'
  ),
  'authority_fingerprint is null',
  'authority_fingerprint hex CHECK preserves nullable unclaimed state'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII a–f / 0–9.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  (
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    collate "C" ~ '^[a-f0-9]{64}$'
  ),
  true,
  'ASCII lowercase hex fingerprint matches under COLLATE C'
);

select is(
  (
    'AAAAAAAAAAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    collate "C" ~ '^[a-f0-9]{64}$'
  ),
  false,
  'uppercase hex fingerprint is rejected under COLLATE C'
);

select * from finish();
rollback;
