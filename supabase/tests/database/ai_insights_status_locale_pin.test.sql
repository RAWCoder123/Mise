-- MISE-005DH: ai_insights.status CHECK must keep the
-- exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept an AI insight lifecycle identity the
-- restored C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ai_insights'::regclass
      and conname = 'ai_insights_status_check'
  ),
  'ai_insights_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.ai_insights'::regclass
      and conname = 'ai_insights_status_check'
  ),
  'status in \(''generated'', ''reviewed'', ''dismissed'', ''applied''\)',
  'ai_insights status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.ai_insights'::regclass
      and conname = 'ai_insights_status_check'
  ),
  'status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'ai_insights status CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('generated' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token generated matches under COLLATE C'
);

select is(
  ('reviewed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token reviewed matches under COLLATE C'
);

select is(
  ('dismissed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token dismissed matches under COLLATE C'
);

select is(
  ('applied' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token applied matches under COLLATE C'
);

select is(
  ('has generated' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced status token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty status token is rejected under COLLATE C'
);

select is(
  ('generated!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated status token is rejected under COLLATE C'
);

select is(
  (E'generat\u00e9d' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII status token is rejected under COLLATE C'
);

select is(
  ('generated' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('reviewed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('dismissed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('applied' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted status tokens match under COLLATE C'
);

select * from finish();
rollback;
