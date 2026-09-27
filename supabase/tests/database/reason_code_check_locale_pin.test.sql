-- MISE-005AN: operational-mode and pilot-control reason_code CHECKs must use
-- COLLATE "C" so dump/restore cannot accept a reason_code the writer gates
-- (MISE-005Y / MISE-005Z) would refuse under C locale.
begin;
select plan(10);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.operational_mode_changes'::regclass
      and conname = 'operational_mode_changes_reason_code_check'
  ),
  'operational_mode_changes_reason_code_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.operational_mode_changes'::regclass
      and conname = 'operational_mode_changes_reason_code_check'
  ),
  'reason_code collate "C" ~ ''\^\[a-z0-9_\]\{3,64\}\$''',
  'operational_mode_changes reason_code CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.pilot_operational_control_changes'::regclass
      and conname = 'pilot_operational_control_changes_reason_code_check'
  ),
  'pilot_operational_control_changes_reason_code_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.pilot_operational_control_changes'::regclass
      and conname = 'pilot_operational_control_changes_reason_code_check'
  ),
  'reason_code collate "C" ~ ''\^\[a-z0-9_\]\{3,64\}\$''',
  'pilot_operational_control_changes reason_code CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII a–z / 0–9 / _.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('pilot_pause' collate "C" ~ '^[a-z0-9_]{3,64}$'),
  true,
  'ASCII snake_case reason_code matches under COLLATE C'
);

select is(
  ('Pilot_Pause' collate "C" ~ '^[a-z0-9_]{3,64}$'),
  false,
  'uppercase reason_code is rejected under COLLATE C'
);

select is(
  ('ab' collate "C" ~ '^[a-z0-9_]{3,64}$'),
  false,
  'too-short reason_code is rejected under COLLATE C'
);

select is(
  ('pilot-pause' collate "C" ~ '^[a-z0-9_]{3,64}$'),
  false,
  'hyphenated reason_code is rejected under COLLATE C'
);

select is(
  (
    select count(*)::int
    from pg_constraint
    where conrelid = 'private.operational_mode_changes'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%reason_code%'
      and pg_get_constraintdef(oid) ilike '%^[a-z0-9_]{3,64}$%'
      and pg_get_constraintdef(oid) not ilike '%collate "C"%'
  ),
  0,
  'operational_mode_changes has no bare reason_code class CHECK'
);

select is(
  (
    select count(*)::int
    from pg_constraint
    where conrelid = 'private.pilot_operational_control_changes'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%reason_code%'
      and pg_get_constraintdef(oid) ilike '%^[a-z0-9_]{3,64}$%'
      and pg_get_constraintdef(oid) not ilike '%collate "C"%'
  ),
  0,
  'pilot_operational_control_changes has no bare reason_code class CHECK'
);

select * from finish();
rollback;
