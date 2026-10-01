-- MISE-005ED: private.pilot_operational_control_changes.backend_identity CHECK
-- must keep the exact equality token and pin ASCII shape under COLLATE "C"
-- so dump/restore cannot accept a pilot backend_identity token the restored
-- C-locale gate would refuse.
begin;
select plan(9);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.pilot_operational_control_changes'::regclass
      and conname = 'pilot_operational_control_changes_backend_identity_check'
  ),
  'pilot_operational_control_changes_backend_identity_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.pilot_operational_control_changes'::regclass
      and conname = 'pilot_operational_control_changes_backend_identity_check'
  ),
  'backend_identity = ''service_role_rpc''',
  'pilot_operational_control_changes backend_identity CHECK keeps exact equality'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.pilot_operational_control_changes'::regclass
      and conname = 'pilot_operational_control_changes_backend_identity_check'
  ),
  'backend_identity collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'pilot_operational_control_changes backend_identity CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('service_role_rpc' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token service_role_rpc matches under COLLATE C'
);

select is(
  ('service role rpc' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced backend_identity token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty backend_identity token is rejected under COLLATE C'
);

select is(
  ('service_role_rpc!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated backend_identity token is rejected under COLLATE C'
);

select is(
  (E'service_role_rp\u00e7' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII backend_identity token is rejected under COLLATE C'
);

select is(
  ('service_role_rpc' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted backend_identity tokens match under COLLATE C'
);

select * from finish();
rollback;
