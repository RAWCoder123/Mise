-- MISE-005DM: outreach_messages.generation_provider CHECK must keep the
-- exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a generation-provider identity the
-- restored C-locale gate would refuse.
begin;
select plan(10);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_generation_provider_check'
  ),
  'outreach_messages_generation_provider_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_generation_provider_check'
  ),
  'generation_provider in \(''openai'', ''deterministic_fallback''\)',
  'outreach_messages generation_provider CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_generation_provider_check'
  ),
  'generation_provider collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'outreach_messages generation_provider CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('openai' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token openai matches under COLLATE C'
);

select is(
  ('deterministic_fallback' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token deterministic_fallback matches under COLLATE C'
);

select is(
  ('deterministic fallback' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced generation_provider token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty generation_provider token is rejected under COLLATE C'
);

select is(
  ('openai!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated generation_provider token is rejected under COLLATE C'
);

select is(
  (E'opena\u00ef' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII generation_provider token is rejected under COLLATE C'
);

select is(
  ('openai' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('deterministic_fallback' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted generation_provider tokens match under COLLATE C'
);

select * from finish();
rollback;
