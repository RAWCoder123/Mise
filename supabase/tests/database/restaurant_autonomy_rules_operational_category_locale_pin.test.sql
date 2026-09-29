-- MISE-005CT: restaurant_autonomy_rules.operational_category CHECK must keep
-- the exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept an autonomy-category identity the restored
-- C-locale gate would refuse.
begin;
select plan(16);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_autonomy_rules'::regclass
      and conname = 'restaurant_autonomy_rules_operational_category_check'
  ),
  'restaurant_autonomy_rules_operational_category_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_autonomy_rules'::regclass
      and conname = 'restaurant_autonomy_rules_operational_category_check'
  ),
  'operational_category in \(''inventory'', ''orders'', ''sales'', ''team'', ''waste'', ''tasks'', ''integrations'', ''settings''\)',
  'restaurant_autonomy_rules operational_category CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_autonomy_rules'::regclass
      and conname = 'restaurant_autonomy_rules_operational_category_check'
  ),
  'operational_category collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'restaurant_autonomy_rules operational_category CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('inventory' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token inventory matches under COLLATE C'
);

select is(
  ('orders' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token orders matches under COLLATE C'
);

select is(
  ('sales' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token sales matches under COLLATE C'
);

select is(
  ('team' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token team matches under COLLATE C'
);

select is(
  ('waste' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token waste matches under COLLATE C'
);

select is(
  ('tasks' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token tasks matches under COLLATE C'
);

select is(
  ('integrations' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token integrations matches under COLLATE C'
);

select is(
  ('settings' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token settings matches under COLLATE C'
);

select is(
  ('in ventory' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced operational_category token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty operational_category token is rejected under COLLATE C'
);

select is(
  ('inventory!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated operational_category token is rejected under COLLATE C'
);

select is(
  (E'invent\u00f6ry' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII operational_category token is rejected under COLLATE C'
);

select is(
  ('inventory' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('orders' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('sales' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('team' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('waste' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('tasks' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('integrations' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('settings' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted operational_category tokens match under COLLATE C'
);

select * from finish();
rollback;
