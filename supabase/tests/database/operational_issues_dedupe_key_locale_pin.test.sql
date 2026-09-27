-- MISE-005AV: operational_issues.dedupe_key CHECK must use COLLATE "C"
-- so dump/restore cannot accept a dedupe identity the restored ASCII
-- C-locale gate would refuse.
begin;
select plan(7);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_dedupe_key_check'
  ),
  'operational_issues_dedupe_key_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_dedupe_key_check'
  ),
  'dedupe_key collate "C" ~ ''\^\[A-Za-z0-9:_-\]\{1,240\}\$''',
  'operational_issues dedupe_key CHECK uses COLLATE C'
);

select is(
  (
    select pg_get_constraintdef(oid) not ilike '%length%dedupe_key%'
    from pg_constraint
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_dedupe_key_check'
  ),
  true,
  'operational_issues dedupe_key CHECK is not length-only'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  (
    'inventory-risk:d0000000-0000-4000-8000-000000000011' collate "C"
      ~ '^[A-Za-z0-9:_-]{1,240}$'
  ),
  true,
  'writer dedupe_key inventory-risk UUID mint matches under COLLATE C'
);

select is(
  (
    'inventory-risk:chicken' collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'
  ),
  true,
  'fixture dedupe_key hyphenated mint matches under COLLATE C'
);

select is(
  ('inventory risk spaced' collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'),
  false,
  'spaced operational-issue dedupe_key is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'),
  false,
  'empty operational-issue dedupe_key is rejected under COLLATE C'
);

select * from finish();
rollback;
