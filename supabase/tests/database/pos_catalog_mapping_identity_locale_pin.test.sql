-- MISE-005BG: pos_catalog_item_mappings external identity CHECKs must reject
-- control-bearing catalog / variation ids under COLLATE "C" while still
-- allowing the empty-string variation sentinel, so restore cannot accept
-- identity bytes the sibling pos_sales provider-identity gate would refuse
-- (and vice versa).
begin;
select plan(11);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pos_catalog_item_mappings'::regclass
      and conname = 'pos_catalog_item_mappings_external_catalog_item_id_check'
  ),
  'pos_catalog_item_mappings_external_catalog_item_id_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pos_catalog_item_mappings'::regclass
      and conname = 'pos_catalog_item_mappings_external_variation_id_check'
  ),
  'pos_catalog_item_mappings_external_variation_id_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_catalog_item_mappings'::regclass
      and conname = 'pos_catalog_item_mappings_external_catalog_item_id_check'
  ),
  'external_catalog_item_id collate "C" !~ ''[[:cntrl:]]''',
  'external_catalog_item_id CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_catalog_item_mappings'::regclass
      and conname = 'pos_catalog_item_mappings_external_catalog_item_id_check'
  ),
  'length\(external_catalog_item_id\) between 1 and 128',
  'external_catalog_item_id CHECK bounds length 1–128'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_catalog_item_mappings'::regclass
      and conname = 'pos_catalog_item_mappings_external_variation_id_check'
  ),
  'external_variation_id = ''''',
  'external_variation_id CHECK allows empty-string sentinel'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_catalog_item_mappings'::regclass
      and conname = 'pos_catalog_item_mappings_external_variation_id_check'
  ),
  'external_variation_id collate "C" !~ ''[[:cntrl:]]''',
  'external_variation_id CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_catalog_item_mappings'::regclass
      and conname = 'pos_catalog_item_mappings_external_variation_id_check'
  ),
  'length\(external_variation_id\) between 1 and 128',
  'external_variation_id CHECK bounds non-empty length 1–128'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  (E'ITEM\tA' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII tab is a control under COLLATE C'
);

select is(
  ('ITEM-A' collate "C" ~ '[[:cntrl:]]'),
  false,
  'printable ASCII catalog id is not a control under COLLATE C'
);

select is(
  ('VAR-A' collate "C" ~ '[[:cntrl:]]'),
  false,
  'printable ASCII variation id is not a control under COLLATE C'
);

select is(
  (E'VAR\u007f' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII DEL is a control under COLLATE C'
);

select * from finish();
rollback;
