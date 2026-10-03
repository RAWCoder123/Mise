-- MISE-005GF: pin public.menu_items.category CHECK to reject
-- control characters under COLLATE "C" and lock the catalog length bound.
--
-- menu_items.category is durable nullable text
-- (operational_data_foundation_inventory_ledger) with no table-level length
-- or control-character gate. Square catalog sync writers
-- (square_backend_oauth_sync and later truthful-count / POS-identity /
-- purchase-approval rewrites) persist
-- left(coalesce(catalog_item->>'category', 'Square'), 80) — a subset of the
-- shared catalog category length bound used by inventory_items.category and
-- pos_sales.category (1..120). Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale
-- drift on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- category is a durable single-line menu/POS catalog category label
-- (provider catalog category snapshot). It is not free-form multiline prose
-- and must not accept LF/TAB/CR/NUL when present. NULL remains allowed
-- because the column is nullable. If LC_CTYPE drifted under a bare (or
-- missing) cntrl gate, dump/restore could accept category bytes a restored
-- C-locale path would refuse — or the reverse — breaking menu catalog
-- continuity across restore.
--
-- Scope:
--   - Attach menu_items_category_check as
--     length(trim(category)) between 1 and 120 PLUS ASCII control rejection
--     under COLLATE "C" (matches sibling catalog category bounds; Square
--     left(..., 80) writers remain a subset)
--   - Dedicated CHECK so this tip stays alone-OK versus
--     menu_items_recipe_authority_check and versus inventory_items /
--     pos_sales / purchase_recommendations / inventory_count_lines stacks
-- Does NOT rewrite Square sync / POS catalog writers, recipe authority,
-- inventory_items.category (#595), or pos_sales.category (#594).
-- Timestamp after MISE-005GE (#595).

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
        con.conname = 'menu_items_category_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%category%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%category%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%recipe_revision%'
          and pg_get_constraintdef(con.oid) not ilike '%recipe_confirmed%'
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
  drop constraint if exists menu_items_category_check;

alter table public.menu_items
  add constraint menu_items_category_check check (
    length(trim(category)) between 1 and 120
    and category collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint menu_items_category_check on public.menu_items is
  'MISE-005GF: menu_items category length(trim) 1..120 plus ASCII control rejection under COLLATE "C" (NULL allowed by CHECK null semantics).';
