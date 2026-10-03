-- MISE-005GG: pin public.menu_items.name CHECK to reject
-- control characters under COLLATE "C" and lock the catalog length bound.
--
-- menu_items.name is durable NOT NULL text
-- (operational_data_foundation_inventory_ledger) with no table-level length
-- or control-character gate. Square catalog sync writers
-- (square_backend_oauth_sync and later truthful-count / POS-identity /
-- purchase-approval rewrites) persist
-- left(trim(coalesce(catalog_item->>'external_name', '')), 160) into name —
-- a subset of the recipe-setup writer bound on menu_item_name (1..200) that
-- can create menu_items via assign_recipe_menu_item_identity. Bare POSIX
-- [[:cntrl:]] follows database LC_CTYPE; this cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; sibling tips
-- re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'`.
--
-- name is a durable single-line menu/POS catalog item label (provider
-- catalog external name / recipe menu item name). It is not free-form
-- multiline prose and must not accept LF/TAB/CR/NUL. If LC_CTYPE drifted
-- under a bare (or missing) cntrl gate, dump/restore could accept name
-- bytes a restored C-locale path would refuse — or the reverse — breaking
-- menu catalog continuity across restore.
--
-- Scope:
--   - Attach menu_items_name_check as
--     length(trim(name)) between 1 and 200 PLUS ASCII control rejection
--     under COLLATE "C" (matches recipe menu_item_name writer bound;
--     Square left(..., 160) writers remain a subset)
--   - Dedicated CHECK so this tip stays alone-OK versus
--     menu_items_recipe_authority_check, menu_items_category_check (#596),
--     and versus inventory/pos_sales/purchase/count-line stacks
-- Does NOT rewrite Square sync / POS catalog / recipe identity writers,
-- recipe authority, menu_items.category (#596), or inventory_items /
-- pos_sales item_name stacks.
-- Timestamp after MISE-005GF (#596).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.menu_items'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'menu_items_name_check'
        or (
          pg_get_constraintdef(con.oid) ~* '\yname\y'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%name%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%recipe_revision%'
          and pg_get_constraintdef(con.oid) not ilike '%recipe_confirmed%'
          and pg_get_constraintdef(con.oid) not ilike '%category%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.menu_items drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.menu_items
  drop constraint if exists menu_items_name_check;

alter table public.menu_items
  add constraint menu_items_name_check check (
    length(trim(name)) between 1 and 200
    and name collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint menu_items_name_check on public.menu_items is
  'MISE-005GG: menu_items name length(trim) 1..200 plus ASCII control rejection under COLLATE "C".';
