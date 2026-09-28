-- MISE-005BS: ai_insights.schema_version CHECK must use COLLATE "C"
-- so dump/restore cannot accept a schema identity the restored ASCII
-- C-locale gate would refuse.
begin;
select plan(7);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ai_insights'::regclass
      and conname = 'ai_insights_schema_version_check'
  ),
  'ai_insights_schema_version_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.ai_insights'::regclass
      and conname = 'ai_insights_schema_version_check'
  ),
  'schema_version collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'ai_insights schema_version CHECK uses COLLATE C'
);

select is(
  (
    select pg_get_constraintdef(oid) not ilike '%length%schema_version%'
    from pg_constraint
    where conrelid = 'public.ai_insights'::regclass
      and conname = 'ai_insights_schema_version_check'
  ),
  true,
  'ai_insights schema_version CHECK is not length-only'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('mise.ai_insight.v1' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer schema_version mise.ai_insight.v1 matches under COLLATE C'
);

select is(
  ('mise ai insight v1' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced ai_insights schema_version is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty ai_insights schema_version is rejected under COLLATE C'
);

select is(
  (
    select not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.ai_insights'::regclass
        and conname = 'ai_insights_schema_version_length_check'
    )
  ),
  true,
  'legacy ai_insights_schema_version_length_check is removed'
);

select * from finish();
rollback;
