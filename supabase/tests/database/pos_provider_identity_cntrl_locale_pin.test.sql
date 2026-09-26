-- MISE-005I: pos_sales provider-identity cntrl CHECKs must be pinned to
-- COLLATE "C" so restore cannot reject identity-bearing sales rows the source
-- accepted.
begin;
select plan(9);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pos_sales'::regclass
      and conname = 'pos_sales_provider_catalog_item_id_check'
  ),
  'pos_sales_provider_catalog_item_id_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pos_sales'::regclass
      and conname = 'pos_sales_provider_location_id_check'
  ),
  'pos_sales_provider_location_id_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pos_sales'::regclass
      and conname = 'pos_sales_provider_variation_id_check'
  ),
  'pos_sales_provider_variation_id_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_sales'::regclass
      and conname = 'pos_sales_provider_catalog_item_id_check'
  ),
  'provider_catalog_item_id collate "C" !~ ''[[:cntrl:]]''',
  'provider_catalog_item_id CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_sales'::regclass
      and conname = 'pos_sales_provider_location_id_check'
  ),
  'provider_location_id collate "C" !~ ''[[:cntrl:]]''',
  'provider_location_id CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_sales'::regclass
      and conname = 'pos_sales_provider_variation_id_check'
  ),
  'provider_variation_id collate "C" !~ ''[[:cntrl:]]''',
  'provider_variation_id CHECK uses COLLATE C cntrl rejection'
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
  'printable ASCII is not a control under COLLATE C'
);

select is(
  (E'VAR\u007f' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII DEL is a control under COLLATE C'
);

select * from finish();
rollback;
