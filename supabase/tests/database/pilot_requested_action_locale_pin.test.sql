-- MISE-005EC: private.pilot_operational_control_changes.requested_action CHECK
-- must keep the exact-token allowlist and pin ASCII shape under COLLATE "C"
-- so dump/restore cannot accept a pilot requested_action token the restored
-- C-locale gate would refuse.
begin;
select plan(18);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.pilot_operational_control_changes'::regclass
      and conname = 'pilot_operational_control_changes_requested_action_check'
  ),
  'pilot_operational_control_changes_requested_action_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.pilot_operational_control_changes'::regclass
      and conname = 'pilot_operational_control_changes_requested_action_check'
  ),
  'requested_action in \(''enable-square-sync'', ''enable-square-webhooks'', ''enable-order-drafting'', ''enable-gmail-delivery'', ''disable-square'', ''disable-order-drafting'', ''disable-gmail-delivery'', ''disable-external'', ''pause-integrations'', ''resume-normal''\)',
  'pilot_operational_control_changes requested_action CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.pilot_operational_control_changes'::regclass
      and conname = 'pilot_operational_control_changes_requested_action_check'
  ),
  'requested_action collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'pilot_operational_control_changes requested_action CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('enable-square-sync' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token enable-square-sync matches under COLLATE C'
);

select is(
  ('enable-square-webhooks' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token enable-square-webhooks matches under COLLATE C'
);

select is(
  ('enable-order-drafting' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token enable-order-drafting matches under COLLATE C'
);

select is(
  ('enable-gmail-delivery' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token enable-gmail-delivery matches under COLLATE C'
);

select is(
  ('disable-square' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token disable-square matches under COLLATE C'
);

select is(
  ('disable-order-drafting' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token disable-order-drafting matches under COLLATE C'
);

select is(
  ('disable-gmail-delivery' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token disable-gmail-delivery matches under COLLATE C'
);

select is(
  ('disable-external' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token disable-external matches under COLLATE C'
);

select is(
  ('pause-integrations' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token pause-integrations matches under COLLATE C'
);

select is(
  ('resume-normal' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token resume-normal matches under COLLATE C'
);

select is(
  ('resume normal' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced requested_action token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty requested_action token is rejected under COLLATE C'
);

select is(
  ('resume-normal!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated requested_action token is rejected under COLLATE C'
);

select is(
  (E'resume-norm\u00e1l' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII requested_action token is rejected under COLLATE C'
);

select is(
  ('enable-square-sync' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('enable-square-webhooks' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('enable-order-drafting' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('enable-gmail-delivery' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('disable-square' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('disable-order-drafting' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('disable-gmail-delivery' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('disable-external' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('pause-integrations' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('resume-normal' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted requested_action tokens match under COLLATE C'
);

select * from finish();
rollback;
