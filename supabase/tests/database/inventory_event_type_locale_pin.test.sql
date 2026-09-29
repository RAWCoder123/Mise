-- MISE-005CF: inventory_events.event_type CHECK must keep
-- the exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a ledger-vocabulary identity the restored
-- C-locale gate would refuse.
begin;
select plan(16);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_event_type_check'
  ),
  'inventory_events_event_type_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_event_type_check'
  ),
  'event_type in \(''receipt'', ''count'', ''waste'', ''stockout'', ''usage'', ''adjustment'', ''transfer'', ''correction''\)',
  'event_type CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_event_type_check'
  ),
  'event_type collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'event_type CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('receipt' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token receipt matches under COLLATE C'
);

select is(
  ('count' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token count matches under COLLATE C'
);

select is(
  ('waste' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token waste matches under COLLATE C'
);

select is(
  ('stockout' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token stockout matches under COLLATE C'
);

select is(
  ('usage' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token usage matches under COLLATE C'
);

select is(
  ('adjustment' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token adjustment matches under COLLATE C'
);

select is(
  ('transfer' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token transfer matches under COLLATE C'
);

select is(
  ('correction' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token correction matches under COLLATE C'
);

select is(
  ('stock out' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced event_type token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty event_type token is rejected under COLLATE C'
);

select is(
  ('receipt!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated event_type token is rejected under COLLATE C'
);

select is(
  (E'receip\u00e9' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII event_type token is rejected under COLLATE C'
);

select is(
  ('receipt' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('count' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('waste' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('stockout' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('usage' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('adjustment' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('transfer' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('correction' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted event_type tokens match under COLLATE C'
);

select * from finish();
rollback;
