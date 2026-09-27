-- MISE-005AS: recalculation_runs.job_name CHECK must use COLLATE "C"
-- so dump/restore cannot accept a job identity the restored ASCII
-- C-locale gate would refuse.
begin;
select plan(8);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.recalculation_runs'::regclass
      and conname = 'recalculation_runs_job_name_check'
  ),
  'recalculation_runs_job_name_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.recalculation_runs'::regclass
      and conname = 'recalculation_runs_job_name_check'
  ),
  'job_name collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'recalculation_runs job_name CHECK uses COLLATE C'
);

select is(
  (
    select pg_get_constraintdef(oid) not ilike '%length%job_name%'
    from pg_constraint
    where conrelid = 'public.recalculation_runs'::regclass
      and conname = 'recalculation_runs_job_name_check'
  ),
  true,
  'recalculation_runs job_name CHECK is not length-only'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('recalculation.daily_open' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer job_name daily_open matches under COLLATE C'
);

select is(
  ('recalculation.mid_shift' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer job_name mid_shift matches under COLLATE C'
);

select is(
  ('recalculation.close' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer job_name close matches under COLLATE C'
);

select is(
  ('recalculation mid shift' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced recalculation job_name is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty recalculation job_name is rejected under COLLATE C'
);

select * from finish();
rollback;
