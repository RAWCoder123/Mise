-- MISE-005DQ: outreach_campaigns.status CHECK must keep the
-- exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a campaign-status token the restored
-- C-locale gate would refuse.
begin;
select plan(15);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_status_check'
  ),
  'outreach_campaigns_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_status_check'
  ),
  'status in \(''draft'', ''active'', ''paused'', ''completed''\)',
  'outreach_campaigns status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_status_check'
  ),
  'status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'outreach_campaigns status CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('draft' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token draft matches under COLLATE C'
);

select is(
  ('active' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token active matches under COLLATE C'
);

select is(
  ('paused' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token paused matches under COLLATE C'
);

select is(
  ('completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token completed matches under COLLATE C'
);

select is(
  ('active campaign' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced status token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty status token is rejected under COLLATE C'
);

select is(
  ('active!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated status token is rejected under COLLATE C'
);

select is(
  (E'activ\u00e9' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII status token is rejected under COLLATE C'
);

select is(
  ('draft' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('active' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('paused' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted status tokens match under COLLATE C'
);

select is(
  ('Draft' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'ASCII-shaped Draft passes shape gate alone under COLLATE C'
);

select is(
  ('DRAFT' in ('draft', 'active', 'paused', 'completed')),
  false,
  'case-shifted DRAFT fails exact allowlist'
);

select is(
  ('draft ' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'trailing-space status token is rejected under COLLATE C'
);

select * from finish();
rollback;
