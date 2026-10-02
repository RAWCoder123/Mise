-- MISE-005FO: public.mise_actions.reason CHECK must keep nullability,
-- bound length(trim) when present, and pin multiline-aware ASCII control
-- rejection under COLLATE "C" so dump/restore cannot accept reason bytes
-- the restored C-locale gate would refuse, while still allowing LF/TAB/CR
-- (operator-facing free-form-ish action prose).
begin;
select plan(15);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_reason_check'
  ),
  'mise_actions_reason_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_reason_check'
  ),
  'reason is null',
  'mise_actions reason CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_reason_check'
  ),
  'length\(trim\(reason\)\) between 1 and 1000',
  'mise_actions reason CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_reason_check'
  ),
  'reason collate "C" !~',
  'mise_actions reason CHECK uses COLLATE C control rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Send the prepared Reliable Produce supplier order after owner or manager approval.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'printable mise_actions reason is accepted under COLLATE C'
);

select is(
  (E'Send the prepared\nReliable Produce supplier order after owner or manager approval.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'LF in mise_actions reason is accepted under multiline-aware gate'
);

select is(
  (E'Send the prepared\tReliable Produce supplier order after owner or manager approval.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'TAB in mise_actions reason is accepted under multiline-aware gate'
);

select is(
  (E'Send the prepared\rReliable Produce supplier order after owner or manager approval.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'CR in mise_actions reason is accepted under multiline-aware gate'
);

select is(
  (E'Send the prepared\x08Reliable Produce supplier order after owner or manager approval.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'BS in mise_actions reason is rejected under COLLATE C'
);

select is(
  (E'Send the prepared\x0bReliable Produce supplier order after owner or manager approval.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'VT in mise_actions reason is rejected under COLLATE C'
);

select is(
  (E'Send the prepared\u007fReliable Produce supplier order after owner or manager approval.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'DEL in mise_actions reason is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'empty string has no unsafe multiline controls under COLLATE C'
);

select is(
  ('Send the prepared Reliable Produce supplier order after owner or manager approval.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Send the prepared\nReliable Produce supplier order after owner or manager approval.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Send the prepared\x0bReliable Produce supplier order after owner or manager approval.' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Send the prepared\u007fReliable Produce supplier order after owner or manager approval.' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'mise_actions reason multiline control detector matches supplier-send allowlist'
);

select is(
  (
    select count(*)
    from (values
      (E'Send the prepared\tReliable Produce supplier order after owner or manager approval.'),
      ('Send the prepared Reliable Produce supplier order after owner or manager approval.'),
      (E'Send the prepared\nReliable Produce supplier order after owner or manager approval.'),
      (E'Send the prepared\rReliable Produce supplier order after owner or manager approval.'),
      (E'Send the prepared\x0bReliable Produce supplier order after owner or manager approval.'),
      (E'Send the prepared\u007fReliable Produce supplier order after owner or manager approval.')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
  ),
  0::bigint,
  'multiline ASCII control detector is identical under C and under the database ctype'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_reason_check'
  ),
  'between 1 and 1000',
  'mise_actions reason CHECK keeps original length window'
);

select * from finish();
rollback;
