-- MISE-005FP: public.mise_actions.error_message CHECK must keep nullability,
-- bound length(trim) when present, and pin multiline-aware ASCII control
-- rejection under COLLATE "C" so dump/restore cannot accept error_message
-- bytes the restored C-locale gate would refuse, while still allowing
-- LF/TAB/CR (operator-facing free-form-ish failure prose).
begin;
select plan(15);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_error_message_check'
  ),
  'mise_actions_error_message_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_error_message_check'
  ),
  'error_message is null',
  'mise_actions error_message CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_error_message_check'
  ),
  'length\(trim\(error_message\)\) between 1 and 1000',
  'mise_actions error_message CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_error_message_check'
  ),
  'error_message collate "C" !~',
  'mise_actions error_message CHECK uses COLLATE C control rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('The Gmail delivery result is uncertain and requires review.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'printable mise_actions error_message is accepted under COLLATE C'
);

select is(
  (E'The Gmail delivery result is uncertain\nand requires review.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'LF in mise_actions error_message is accepted under multiline-aware gate'
);

select is(
  (E'The Gmail delivery result is uncertain\tand requires review.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'TAB in mise_actions error_message is accepted under multiline-aware gate'
);

select is(
  (E'The Gmail delivery result is uncertain\rand requires review.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'CR in mise_actions error_message is accepted under multiline-aware gate'
);

select is(
  (E'The Gmail delivery result is uncertain\x08and requires review.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'BS in mise_actions error_message is rejected under COLLATE C'
);

select is(
  (E'The Gmail delivery result is uncertain\x0band requires review.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'VT in mise_actions error_message is rejected under COLLATE C'
);

select is(
  (E'The Gmail delivery result is uncertain\u007fand requires review.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'DEL in mise_actions error_message is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'empty string has no unsafe multiline controls under COLLATE C'
);

select is(
  ('The Gmail delivery result is uncertain and requires review.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'The Gmail delivery result is uncertain\nand requires review.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'The Gmail delivery result is uncertain\x0band requires review.' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'The Gmail delivery result is uncertain\u007fand requires review.' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'mise_actions error_message multiline control detector matches supplier-send allowlist'
);

select is(
  (
    select count(*)
    from (values
      (E'The Gmail delivery result is uncertain\tand requires review.'),
      ('The Gmail delivery result is uncertain and requires review.'),
      (E'The Gmail delivery result is uncertain\nand requires review.'),
      (E'The Gmail delivery result is uncertain\rand requires review.'),
      (E'The Gmail delivery result is uncertain\x0band requires review.'),
      (E'The Gmail delivery result is uncertain\u007fand requires review.')
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
      and conname = 'mise_actions_error_message_check'
  ),
  'between 1 and 1000',
  'mise_actions error_message CHECK keeps original length window'
);

select * from finish();
rollback;
