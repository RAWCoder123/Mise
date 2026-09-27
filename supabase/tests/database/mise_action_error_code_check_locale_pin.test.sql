-- MISE-005AO: mise_actions.error_code CHECK must use COLLATE "C" so
-- dump/restore cannot accept an error_code the failure writer gate
-- (MISE-005AG) would refuse under C locale.
begin;
select plan(8);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_error_code_check'
  ),
  'mise_actions_error_code_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_error_code_check'
  ),
  'error_code collate "C" ~ ''\^\[a-z0-9_\]\{1,80\}\$''',
  'mise_actions.error_code CHECK uses COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_error_code_check'
  ),
  'error_code is null',
  'mise_actions.error_code CHECK allows null success rows'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII a–z / 0–9 / _.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('gmail_send_failed' collate "C" ~ '^[a-z0-9_]{1,80}$'),
  true,
  'ASCII snake_case error_code matches under COLLATE C'
);

select is(
  ('Gmail_Send_Failed' collate "C" ~ '^[a-z0-9_]{1,80}$'),
  false,
  'uppercase error_code is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[a-z0-9_]{1,80}$'),
  false,
  'empty error_code is rejected under COLLATE C'
);

select is(
  ('gmail-send-failed' collate "C" ~ '^[a-z0-9_]{1,80}$'),
  false,
  'hyphenated error_code is rejected under COLLATE C'
);

select is(
  (
    select count(*)::int
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%error_code%'
      and pg_get_constraintdef(oid) ilike '%^[a-z0-9_]{1,80}$%'
      and pg_get_constraintdef(oid) not ilike '%collate "C"%'
  ),
  0,
  'mise_actions has no bare error_code class CHECK'
);

select * from finish();
rollback;
