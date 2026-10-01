-- MISE-005DX: private.pilot_operational_control_changes.control_domain CHECK
-- must keep the exact-token allowlist and pin ASCII shape under COLLATE "C"
-- so dump/restore cannot accept a pilot control-domain token the restored
-- C-locale gate would refuse.
begin;
select plan(13);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.pilot_operational_control_changes'::regclass
      and conname = 'pilot_operational_control_changes_control_domain_check'
  ),
  'pilot_operational_control_changes_control_domain_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.pilot_operational_control_changes'::regclass
      and conname = 'pilot_operational_control_changes_control_domain_check'
  ),
  'control_domain in \(''square'', ''drafting'', ''gmail'', ''external'', ''system_mode''\)',
  'pilot_operational_control_changes control_domain CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.pilot_operational_control_changes'::regclass
      and conname = 'pilot_operational_control_changes_control_domain_check'
  ),
  'control_domain collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'pilot_operational_control_changes control_domain CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('square' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token square matches under COLLATE C'
);

select is(
  ('drafting' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token drafting matches under COLLATE C'
);

select is(
  ('gmail' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token gmail matches under COLLATE C'
);

select is(
  ('external' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token external matches under COLLATE C'
);

select is(
  ('system_mode' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token system_mode matches under COLLATE C'
);

select is(
  ('system mode' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced control_domain token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty control_domain token is rejected under COLLATE C'
);

select is(
  ('square!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated control_domain token is rejected under COLLATE C'
);

select is(
  (E'squar\u00e9' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII control_domain token is rejected under COLLATE C'
);

select is(
  ('square' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('drafting' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('gmail' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('external' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('system_mode' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted control_domain tokens match under COLLATE C'
);

select * from finish();
rollback;
