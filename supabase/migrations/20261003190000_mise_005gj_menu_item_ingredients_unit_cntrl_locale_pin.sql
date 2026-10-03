-- MISE-005GJ: pin public.menu_item_ingredients.unit CHECK to reject
-- control characters under COLLATE "C" and lock the recipe unit length bound.
--
-- menu_item_ingredients.unit is durable NOT NULL text
-- (secure_multi_tenant_rls) with no table-level length or control-character
-- gate. Atomic setup and recipe upsert writers
-- (atomic_setup_and_operational_signals / secure_operational_workflows and
-- later durable-supplier rewrites) already enforce
-- length(trim(unit)) between 1 and 40 before insert/update.
-- Bare POSIX [[:cntrl:]] follows database LC_CTYPE; this cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; sibling tips
-- re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'`.
--
-- unit is a durable single-line recipe ingredient unit-of-measure label
-- (for example oz, lb, ea). It is not free-form multiline prose and must
-- not accept LF/TAB/CR/NUL. If LC_CTYPE drifted under a bare (or missing)
-- cntrl gate, dump/restore could accept unit bytes a restored C-locale
-- path would refuse — or the reverse — breaking recipe mapping continuity
-- across restore.
--
-- Scope:
--   - Attach menu_item_ingredients_unit_check as
--     length(trim(unit)) between 1 and 40 PLUS ASCII control rejection
--     under COLLATE "C" (matches recipe unit writer bound)
--   - Dedicated CHECK so this tip stays alone-OK versus
--     menu_item_ingredients_quantity_used_per_sale_check,
--     menu_item_ingredients_menu_item_name_check (#599), and versus
--     inventory_items.unit (#586) / inventory_count_lines.unit (#593) /
--     purchase_recommendations.unit (#590) stacks
-- Does NOT rewrite setup / recipe writers, quantity bounds, menu_item_name
-- (#599), or sibling unit stacks. Timestamp after MISE-005GI (#599).

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
        con.conname = 'menu_item_ingredients_unit_check'
        or (
          pg_get_constraintdef(con.oid) ~* '\yunit\y'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%unit%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%quantity_used_per_sale%'
          and pg_get_constraintdef(con.oid) !~* '\mlength\s*\(\s*trim\s*\(\s*menu_item_name\s*\)'
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
  drop constraint if exists menu_item_ingredients_unit_check;

alter table public.menu_item_ingredients
  add constraint menu_item_ingredients_unit_check check (
    length(trim(unit)) between 1 and 40
    and unit collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint menu_item_ingredients_unit_check on public.menu_item_ingredients is
  'MISE-005GJ: menu_item_ingredients unit length(trim) 1..40 plus ASCII control rejection under COLLATE "C".';
