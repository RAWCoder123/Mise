-- MISE-005BZ: edge_function_security_events.function_name CHECK must keep
-- the exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a firewall identity the restored C-locale
-- gate would refuse.
begin;
select plan(13);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.edge_function_security_events'::regclass
      and conname = 'edge_function_security_events_function_name_check'
  ),
  'edge_function_security_events_function_name_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.edge_function_security_events'::regclass
      and conname = 'edge_function_security_events_function_name_check'
  ),
  'function_name in \(''sync-pos-sales'', ''generate-ai-insights'', ''link-gmail'', ''gmail-oauth-callback'', ''send-supplier-email'', ''operational-workflows'', ''delete-account'', ''export-restaurant-data'', ''link-square'', ''square-oauth-callback'', ''square-webhooks''\)',
  'function_name CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.edge_function_security_events'::regclass
      and conname = 'edge_function_security_events_function_name_check'
  ),
  'function_name collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'function_name CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('sync-pos-sales' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token sync-pos-sales matches under COLLATE C'
);

select is(
  ('export-restaurant-data' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token export-restaurant-data matches under COLLATE C'
);

select is(
  ('square-webhooks' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token square-webhooks matches under COLLATE C'
);

select is(
  ('sync pos sales' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced function_name token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty function_name token is rejected under COLLATE C'
);

select is(
  ('sync-pos-sales!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated function_name token is rejected under COLLATE C'
);

select is(
  (E'sync-pos-sal\u00e9s' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII function_name token is rejected under COLLATE C'
);

select is(
  ('sync-pos-sales' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('generate-ai-insights' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('link-gmail' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('gmail-oauth-callback' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('send-supplier-email' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('operational-workflows' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('delete-account' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('export-restaurant-data' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('link-square' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('square-oauth-callback' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('square-webhooks' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted function_name tokens match under COLLATE C'
);

select ok(
  position('export-restaurant-data' in pg_get_constraintdef(oid)) > 0,
  'the Edge event constraint still accepts restaurant export events'
)
from pg_constraint
where conrelid = 'private.edge_function_security_events'::regclass
  and conname = 'edge_function_security_events_function_name_check';

select is(
  position('collate "C"' in lower(pg_get_constraintdef(oid))) > 0
    or position('COLLATE "C"' in pg_get_constraintdef(oid)) > 0,
  true,
  'export-compatible function_name CHECK remains pinned under COLLATE C'
)
from pg_constraint
where conrelid = 'private.edge_function_security_events'::regclass
  and conname = 'edge_function_security_events_function_name_check';

select * from finish();
rollback;
