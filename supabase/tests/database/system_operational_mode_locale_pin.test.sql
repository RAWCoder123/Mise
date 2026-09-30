-- MISE-005DE: system_operational_controls.operational_mode CHECK must keep
-- the exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept an operational-mode identity the restored
-- C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.system_operational_controls'::regclass
      and conname = 'system_operational_controls_operational_mode_check'
  ),
  'system_operational_controls_operational_mode_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.system_operational_controls'::regclass
      and conname = 'system_operational_controls_operational_mode_check'
  ),
  'operational_mode in \(''normal'', ''read_only'', ''integrations_paused'', ''emergency''\)',
  'system_operational_controls operational_mode CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.system_operational_controls'::regclass
      and conname = 'system_operational_controls_operational_mode_check'
  ),
  'operational_mode collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'system_operational_controls operational_mode CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('normal' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token normal matches under COLLATE C'
);

select is(
  ('read_only' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token read_only matches under COLLATE C'
);

select is(
  ('integrations_paused' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token integrations_paused matches under COLLATE C'
);

select is(
  ('emergency' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token emergency matches under COLLATE C'
);

select is(
  ('read only' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced operational_mode token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty operational_mode token is rejected under COLLATE C'
);

select is(
  ('emergency!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated operational_mode token is rejected under COLLATE C'
);

select is(
  (E'emergenc\u00e9' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII operational_mode token is rejected under COLLATE C'
);

select is(
  ('normal' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('read_only' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('integrations_paused' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('emergency' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted operational_mode tokens match under COLLATE C'
);

select * from finish();
rollback;
