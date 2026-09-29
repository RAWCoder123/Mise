-- MISE-005CA: edge_function_security_events.event_type CHECK must keep
-- the exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a firewall classification the restored
-- C-locale gate would refuse.
begin;
select plan(13);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.edge_function_security_events'::regclass
      and conname = 'edge_function_security_events_event_type_check'
  ),
  'edge_function_security_events_event_type_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.edge_function_security_events'::regclass
      and conname = 'edge_function_security_events_event_type_check'
  ),
  'event_type in \(''allowed'', ''denied'', ''rate_limited'', ''blocked'', ''completed'', ''error''\)',
  'event_type CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.edge_function_security_events'::regclass
      and conname = 'edge_function_security_events_event_type_check'
  ),
  'event_type collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'event_type CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('allowed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token allowed matches under COLLATE C'
);

select is(
  ('rate_limited' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token rate_limited matches under COLLATE C'
);

select is(
  ('completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token completed matches under COLLATE C'
);

select is(
  ('rate limited' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced event_type token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty event_type token is rejected under COLLATE C'
);

select is(
  ('allowed!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated event_type token is rejected under COLLATE C'
);

select is(
  (E'allowe\u00e9d' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII event_type token is rejected under COLLATE C'
);

select is(
  ('allowed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('denied' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('rate_limited' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('blocked' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('error' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted event_type tokens match under COLLATE C'
);

select ok(
  position('rate_limited' in pg_get_constraintdef(oid)) > 0,
  'the Edge event constraint still accepts rate_limited events'
)
from pg_constraint
where conrelid = 'private.edge_function_security_events'::regclass
  and conname = 'edge_function_security_events_event_type_check';

select is(
  position('collate "C"' in lower(pg_get_constraintdef(oid))) > 0
    or position('COLLATE "C"' in pg_get_constraintdef(oid)) > 0,
  true,
  'rate_limited-compatible event_type CHECK remains pinned under COLLATE C'
)
from pg_constraint
where conrelid = 'private.edge_function_security_events'::regclass
  and conname = 'edge_function_security_events_event_type_check';

select * from finish();
rollback;
