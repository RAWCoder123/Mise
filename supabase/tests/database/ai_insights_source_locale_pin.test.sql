-- MISE-005DJ: ai_insights.source CHECK must keep the
-- exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept an AI insight source identity the
-- restored C-locale gate would refuse.
begin;
select plan(11);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ai_insights'::regclass
      and conname = 'ai_insights_source_check'
  ),
  'ai_insights_source_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.ai_insights'::regclass
      and conname = 'ai_insights_source_check'
  ),
  'source in \(''openai_structured_output'', ''rules_engine'', ''operator_note''\)',
  'ai_insights source CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.ai_insights'::regclass
      and conname = 'ai_insights_source_check'
  ),
  'source collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'ai_insights source CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('openai_structured_output' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token openai_structured_output matches under COLLATE C'
);

select is(
  ('rules_engine' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token rules_engine matches under COLLATE C'
);

select is(
  ('operator_note' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token operator_note matches under COLLATE C'
);

select is(
  ('rules engine' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced source token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty source token is rejected under COLLATE C'
);

select is(
  ('rules_engine!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated source token is rejected under COLLATE C'
);

select is(
  (E'rules_\u00ebngine' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII source token is rejected under COLLATE C'
);

select is(
  ('openai_structured_output' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('rules_engine' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('operator_note' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted source tokens match under COLLATE C'
);

select * from finish();
rollback;
