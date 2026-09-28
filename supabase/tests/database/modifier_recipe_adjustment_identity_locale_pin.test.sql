-- MISE-005BH: modifier_recipe_adjustments.external_modifier_id CHECK must
-- reject control-bearing modifier ids under COLLATE "C", so restore cannot
-- accept identity bytes the sibling sale selected_modifier_ids gate would
-- refuse (and vice versa).
begin;
select plan(7);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.modifier_recipe_adjustments'::regclass
      and conname = 'modifier_recipe_adjustments_external_modifier_id_check'
  ),
  'modifier_recipe_adjustments_external_modifier_id_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.modifier_recipe_adjustments'::regclass
      and conname = 'modifier_recipe_adjustments_external_modifier_id_check'
  ),
  'external_modifier_id collate "C" !~ ''[[:cntrl:]]''',
  'external_modifier_id CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.modifier_recipe_adjustments'::regclass
      and conname = 'modifier_recipe_adjustments_external_modifier_id_check'
  ),
  'length\(external_modifier_id\) between 1 and 128',
  'external_modifier_id CHECK bounds length 1–128'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  (E'MOD\tA' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII tab is a control under COLLATE C'
);

select is(
  ('MOD-A' collate "C" ~ '[[:cntrl:]]'),
  false,
  'printable ASCII modifier id is not a control under COLLATE C'
);

select is(
  ('mod_1' collate "C" ~ '[[:cntrl:]]'),
  false,
  'printable ASCII lowercase modifier id is not a control under COLLATE C'
);

select is(
  (E'MOD\u007f' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII DEL is a control under COLLATE C'
);

select * from finish();
rollback;
