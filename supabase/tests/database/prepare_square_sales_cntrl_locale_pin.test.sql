-- MISE-005U: prepare_square_sales_for_authority cntrl preflights must use
-- COLLATE "C" so prepare cannot accept provider identity bytes a restored
-- C-locale pos_sales CHECK would reject after locale drift (and vice versa).
begin;
select plan(5);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'private'::regnamespace
      and proname = 'prepare_square_sales_for_authority'
      and pg_get_function_identity_arguments(oid)
        = 'uuid, uuid, jsonb, jsonb, date, date, boolean'
  ),
  'private.prepare_square_sales_for_authority(uuid, uuid, jsonb, jsonb, date, date, boolean) exists'
);

select matches(
  pg_get_functiondef(
    'private.prepare_square_sales_for_authority(uuid, uuid, jsonb, jsonb, date, date, boolean)'::regprocedure
  ),
  'sale_source_record_id collate "C" ~ ''\[\[:cntrl:\]\]''',
  'prepare sale_source_record_id cntrl preflight uses COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.prepare_square_sales_for_authority(uuid, uuid, jsonb, jsonb, date, date, boolean)'::regprocedure
  ),
  'coalesce\(incoming_catalog_item_id, ''''\) collate "C" ~ ''\[\[:cntrl:\]\]''',
  'prepare provider-identity cntrl preflights use COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.prepare_square_sales_for_authority(uuid, uuid, jsonb, jsonb, date, date, boolean)'::regprocedure
  ),
  'derived_catalog_item_id collate "C" ~ ''\[\[:cntrl:\]\]''',
  'prepare derived_catalog_item_id cntrl preflight uses COLLATE C'
);

select is(
  has_function_privilege(
    'authenticated',
    'private.prepare_square_sales_for_authority(uuid, uuid, jsonb, jsonb, date, date, boolean)',
    'EXECUTE'
  ),
  false,
  'authenticated lacks EXECUTE on prepare_square_sales_for_authority'
);

select * from finish();
rollback;
