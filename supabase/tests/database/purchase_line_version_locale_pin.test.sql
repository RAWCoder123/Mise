-- MISE-005BU: purchase_lines normalization_version and evidence_version
-- CHECKs must use COLLATE "C" so dump/restore cannot accept a contract
-- identity the restored ASCII C-locale gate would refuse.
begin;
select plan(11);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_normalization_version_check'
  ),
  'purchase_lines_normalization_version_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_evidence_version_check'
  ),
  'purchase_lines_evidence_version_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_normalization_version_check'
  ),
  'normalization_version collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'normalization_version CHECK uses COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_evidence_version_check'
  ),
  'evidence_version collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'evidence_version CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('mise.purchase_line_normalization.v1' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer normalization_version matches under COLLATE C'
);

select is(
  ('mise.purchase_line.v1' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer evidence_version matches under COLLATE C'
);

select is(
  ('mise purchase line normalization v1' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced normalization_version is rejected under COLLATE C'
);

select is(
  ('mise purchase line v1' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced evidence_version is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty purchase-line version token is rejected under COLLATE C'
);

select is(
  ('mise.purchase_line.v1!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated evidence_version is rejected under COLLATE C'
);

select is(
  (E'mise.purchase_line.\u00e9v1' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII evidence_version is rejected under COLLATE C'
);

select * from finish();
rollback;
