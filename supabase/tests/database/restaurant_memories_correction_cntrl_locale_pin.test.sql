-- MISE-005FA: public.restaurant_memories.correction CHECK must keep nullability,
-- bound length(trim) when present, and pin multiline-aware ASCII control
-- rejection under COLLATE "C" so dump/restore cannot accept correction bytes
-- the restored C-locale gate would refuse, while still allowing LF/TAB/CR
-- (operator free-form; may also flow into activity_events.summary).
begin;
select plan(15);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_correction_check'
  ),
  'restaurant_memories_correction_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_correction_check'
  ),
  'correction is null',
  'restaurant_memories correction CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_correction_check'
  ),
  'length\(trim\(correction\)\) between 1 and 1000',
  'restaurant_memories correction CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_correction_check'
  ),
  'correction collate "C" !~',
  'restaurant_memories correction CHECK uses COLLATE C control rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Deliveries are usually 1 day late on Mondays.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'printable restaurant memory correction is accepted under COLLATE C'
);

select is(
  (E'Deliveries are usually\n1 day late on Mondays.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'LF in restaurant memory correction is accepted under multiline-aware gate'
);

select is(
  (E'Deliveries are usually\t1 day late on Mondays.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'TAB in restaurant memory correction is accepted under multiline-aware gate'
);

select is(
  (E'Deliveries are usually\r1 day late on Mondays.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'CR in restaurant memory correction is accepted under multiline-aware gate'
);

select is(
  (E'Deliveries are usually\x081 day late on Mondays.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'BS in restaurant memory correction is rejected under COLLATE C'
);

select is(
  (E'Deliveries are usually\x0b1 day late on Mondays.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'VT in restaurant memory correction is rejected under COLLATE C'
);

select is(
  (E'Deliveries are usually\u007f1 day late on Mondays.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'DEL in restaurant memory correction is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'empty string has no unsafe multiline controls under COLLATE C'
);

select is(
  ('Deliveries are usually 1 day late on Mondays.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Deliveries are usually\n1 day late on Mondays.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Deliveries are usually\x0b1 day late on Mondays.' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Deliveries are usually\u007f1 day late on Mondays.' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'restaurant memory correction multiline control detector matches supplier-send allowlist'
);

select is(
  (
    select count(*)
    from (values
      (E'Deliveries are usually\t1 day late on Mondays.'),
      ('Deliveries are usually 1 day late on Mondays.'),
      (E'Deliveries are usually\n1 day late on Mondays.'),
      (E'Deliveries are usually\r1 day late on Mondays.'),
      (E'Deliveries are usually\x0b1 day late on Mondays.'),
      (E'Deliveries are usually\u007f1 day late on Mondays.')
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
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_correction_check'
  ),
  'between 1 and 1000',
  'restaurant_memories correction CHECK keeps original length window'
);

select * from finish();
rollback;
