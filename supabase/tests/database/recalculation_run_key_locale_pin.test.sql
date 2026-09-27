-- MISE-005AR: recalculation_runs cycle_key / idempotency_key CHECKs must
-- use COLLATE "C" so dump/restore cannot accept an identity key the
-- restored ASCII C-locale gate would refuse.
begin;
select plan(10);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.recalculation_runs'::regclass
      and conname = 'recalculation_runs_cycle_key_check'
  ),
  'recalculation_runs_cycle_key_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.recalculation_runs'::regclass
      and conname = 'recalculation_runs_idempotency_key_check'
  ),
  'recalculation_runs_idempotency_key_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.recalculation_runs'::regclass
      and conname = 'recalculation_runs_cycle_key_check'
  ),
  'cycle_key collate "C" ~ ''\^\[A-Za-z0-9:_-\]\{1,240\}\$''',
  'recalculation_runs cycle_key CHECK uses COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.recalculation_runs'::regclass
      and conname = 'recalculation_runs_idempotency_key_check'
  ),
  'idempotency_key collate "C" ~ ''\^\[A-Za-z0-9:_-\]\{1,240\}\$''',
  'recalculation_runs idempotency_key CHECK uses COLLATE C'
);

select is(
  (
    select pg_get_constraintdef(oid) not ilike '%length%cycle_key%'
    from pg_constraint
    where conrelid = 'public.recalculation_runs'::regclass
      and conname = 'recalculation_runs_cycle_key_check'
  ),
  true,
  'recalculation_runs cycle_key CHECK is not length-only'
);

select is(
  (
    select pg_get_constraintdef(oid) not ilike '%length%idempotency_key%'
    from pg_constraint
    where conrelid = 'public.recalculation_runs'::regclass
      and conname = 'recalculation_runs_idempotency_key_check'
  ),
  true,
  'recalculation_runs idempotency_key CHECK is not length-only'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('recalc:a0000000-0000-4000-8000-000000000001:2026-08-05:daily_open'
    collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'),
  true,
  'writer cycle_key matches under COLLATE C'
);

select is(
  ('recalc:a0000000-0000-4000-8000-000000000001:2026-08-05:daily_open:attempt-1'
    collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'),
  true,
  'writer idempotency_key matches under COLLATE C'
);

select is(
  ('recalc: mid shift' collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'),
  false,
  'spaced recalculation key is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'),
  false,
  'empty recalculation key is rejected under COLLATE C'
);

select * from finish();
rollback;
