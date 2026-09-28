-- MISE-005BW: ai_insights server provenance CHECK must keep the
-- exact-token allowlists and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a provenance identity the restored C-locale
-- gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ai_insights'::regclass
      and conname = 'ai_insights_server_provenance_check'
  ),
  'ai_insights_server_provenance_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.ai_insights'::regclass
      and conname = 'ai_insights_server_provenance_check'
  ),
  'source = ''rules_engine''',
  'provenance CHECK keeps exact source allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.ai_insights'::regclass
      and conname = 'ai_insights_server_provenance_check'
  ),
  'generated_by in \(''edge_function_scaffold'', ''mise_rules'', ''staging_seed'', ''legacy_unverified''\)',
  'provenance CHECK keeps exact generated_by allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.ai_insights'::regclass
      and conname = 'ai_insights_server_provenance_check'
  ),
  'source collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'provenance source CHECK uses COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.ai_insights'::regclass
      and conname = 'ai_insights_server_provenance_check'
  ),
  'generated_by collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'provenance generated_by CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('rules_engine' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer source rules_engine matches under COLLATE C'
);

select is(
  ('edge_function_scaffold' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer generated_by edge_function_scaffold matches under COLLATE C'
);

select is(
  ('mise rules' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced provenance token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty provenance token is rejected under COLLATE C'
);

select is(
  ('rules_engine!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated provenance token is rejected under COLLATE C'
);

select is(
  (E'rules_engin\u00e9' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII provenance token is rejected under COLLATE C'
);

select is(
  ('mise_rules' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('staging_seed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('legacy_unverified' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'seed generated_by tokens match under COLLATE C'
);

select * from finish();
rollback;
