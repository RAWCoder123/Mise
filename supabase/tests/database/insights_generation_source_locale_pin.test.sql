-- MISE-005BY: insights.generation_source CHECK must keep
-- the exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a provenance identity the restored C-locale
-- gate would refuse.
begin;
select plan(11);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.insights'::regclass
      and conname = 'insights_generation_source_check'
  ),
  'insights_generation_source_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.insights'::regclass
      and conname = 'insights_generation_source_check'
  ),
  'generation_source in \(''manual'', ''mise_rules'', ''legacy_client''\)',
  'generation_source CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.insights'::regclass
      and conname = 'insights_generation_source_check'
  ),
  'generation_source collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'generation_source CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('manual' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token manual matches under COLLATE C'
);

select is(
  ('mise_rules' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token mise_rules matches under COLLATE C'
);

select is(
  ('legacy_client' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token legacy_client matches under COLLATE C'
);

select is(
  ('mise rules' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced generation_source token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty generation_source token is rejected under COLLATE C'
);

select is(
  ('mise_rules!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated generation_source token is rejected under COLLATE C'
);

select is(
  (E'mise_rul\u00e9s' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII generation_source token is rejected under COLLATE C'
);

select is(
  ('manual' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('mise_rules' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('legacy_client' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted generation_source tokens match under COLLATE C'
);

select * from finish();
rollback;
