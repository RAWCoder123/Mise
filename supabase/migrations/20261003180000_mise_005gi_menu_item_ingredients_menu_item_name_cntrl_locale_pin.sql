-- MISE-005GI: pin public.menu_item_ingredients.menu_item_name CHECK to reject
-- control characters under COLLATE "C" and lock the recipe label length bound.
--
-- menu_item_ingredients.menu_item_name is durable NOT NULL text
-- (secure_multi_tenant_rls) with no table-level length or control-character
-- gate. Atomic setup and recipe upsert writers
-- (atomic_setup_and_operational_signals / secure_operational_workflows and
-- later durable-supplier rewrites) already enforce
-- length(trim(menu_item_name)) between 1 and 200 before insert/update.
-- Bare POSIX [[:cntrl:]] follows database LC_CTYPE; this cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; sibling tips
-- re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'`.
--
-- menu_item_name is a durable single-line recipe / menu item label used to
-- join POS sales and menu catalog identity. It is not free-form multiline
-- prose and must not accept LF/TAB/CR/NUL. If LC_CTYPE drifted under a bare
-- (or missing) cntrl gate, dump/restore could accept menu_item_name bytes a
-- restored C-locale path would refuse — or the reverse — breaking recipe
-- mapping continuity across restore.
--
-- Scope:
--   - Attach menu_item_ingredients_menu_item_name_check as
--     length(trim(menu_item_name)) between 1 and 200 PLUS ASCII control
--     rejection under COLLATE "C" (matches recipe writer bound)
--   - Dedicated CHECK so this tip stays alone-OK versus
--     menu_item_ingredients_quantity_used_per_sale_check, unit (still
--     ungated at table level), and versus menu_items.name (#597) /
--     inventory/pos_sales/purchase/count-line stacks
-- Does NOT rewrite setup / recipe / POS identity writers, quantity bounds,
-- unit, or sibling item_name stacks.
-- Timestamp after MISE-005GH (#598).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.menu_item_ingredients'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'menu_item_ingredients_menu_item_name_check'
        or (
          pg_get_constraintdef(con.oid) ~* '\ymenu_item_name\y'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%menu_item_name%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%quantity_used_per_sale%'
          and pg_get_constraintdef(con.oid) !~* '\mlength\s*\(\s*trim\s*\(\s*unit\s*\)'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.menu_item_ingredients drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.menu_item_ingredients
  drop constraint if exists menu_item_ingredients_menu_item_name_check;

alter table public.menu_item_ingredients
  add constraint menu_item_ingredients_menu_item_name_check check (
    length(trim(menu_item_name)) between 1 and 200
    and menu_item_name collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint menu_item_ingredients_menu_item_name_check on public.menu_item_ingredients is
  'MISE-005GI: menu_item_ingredients menu_item_name length(trim) 1..200 plus ASCII control rejection under COLLATE "C".';
