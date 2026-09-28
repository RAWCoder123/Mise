-- MISE-005BQ: purchase_lines.normalized_item_key CHECK must reject control
-- characters under COLLATE "C" while preserving the foundation length 1–500
-- bound and NULL (could_not_verify / empty normalize), so restore cannot
-- accept key bytes a restored C-locale gate would refuse (and vice versa).
-- Does not weaken purchase_lines_normalized_key_check (normalize equality).
begin;
select plan(9);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_normalized_item_key_check'
  ),
  'purchase_lines_normalized_item_key_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_normalized_key_check'
  ),
  'purchase_lines_normalized_key_check (normalize equality) still exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_normalized_item_key_check'
  ),
  'normalized_item_key is null',
  'purchase_lines.normalized_item_key CHECK allows NULL'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_normalized_item_key_check'
  ),
  'normalized_item_key collate "C" !~ ''[[:cntrl:]]''',
  'purchase_lines.normalized_item_key CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_normalized_item_key_check'
  ),
  'length\(normalized_item_key\) between 1 and 500',
  'purchase_lines.normalized_item_key CHECK preserves length 1–500 bound'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  (E'chicken\tbreast' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII tab is a control under COLLATE C'
);

select is(
  ('chicken breast' collate "C" ~ '[[:cntrl:]]'),
  false,
  'printable ASCII normalized item key is not a control under COLLATE C'
);

select is(
  (E'chicken\u007fbreast' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII DEL is a control under COLLATE C'
);

select is(
  (repeat('a', 500) collate "C" ~ '[[:cntrl:]]'),
  false,
  'max-length printable ASCII key is not a control under COLLATE C'
);

select * from finish();
rollback;
