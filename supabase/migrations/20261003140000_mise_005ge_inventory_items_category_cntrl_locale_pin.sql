-- MISE-005GE: pin public.inventory_items.category CHECK to reject
-- control characters under COLLATE "C" and lock the writer length bound.
--
-- inventory_items.category is durable NOT NULL text (secure_multi_tenant_rls)
-- with no table-level length or control-character gate. Writer authority in
-- save_restaurant_setup (atomic_setup / MISE-003C durable supplier rewrite)
-- trims category and refuses length not between 1 and 120 before insert or
-- upsert. inventory_items_operational_values_check (harden_workflow_authority
-- and MISE-005FU/005FV/005FW sibling tips) intentionally covers item_name,
-- unit, supplier_name, and quantity bounds only — category is not on that
-- shared constraint. Bare POSIX [[:cntrl:]] follows database LC_CTYPE; this
-- cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- category is a durable single-line inventory catalog label (Protein,
-- Produce, Dairy, …). It is not free-form multiline prose and must not
-- accept LF/TAB/CR/NUL. If LC_CTYPE drifted under a bare (or missing) cntrl
-- gate, dump/restore could accept category bytes a restored C-locale path
-- would refuse — or the reverse — breaking inventory continuity across
-- restore.
--
-- Scope:
--   - Attach inventory_items_category_check as
--     length(trim(category)) between 1 and 120 PLUS ASCII control rejection
--     under COLLATE "C" (matches save_restaurant_setup writer bound)
--   - Dedicated CHECK so this tip stays alone-OK versus the
--     inventory_items_operational_values_check stack (#585/#586/#587)
-- Does NOT rewrite setup/save inventory writers, operational_values_check,
-- item_name/unit/supplier_name cntrl tips, canonical_unit (#490/#491),
-- inventory count notes (#552), pos_sales.category (#594), or
-- menu_items.category.
-- Timestamp after MISE-005GD (#594).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.inventory_items'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'inventory_items_category_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%category%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%category%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%item_name%'
          and pg_get_constraintdef(con.oid) not ilike '%supplier_name%'
          and pg_get_constraintdef(con.oid) not ilike '%current_quantity%'
          and pg_get_constraintdef(con.oid) not ilike '%canonical_unit%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.inventory_items drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.inventory_items
  drop constraint if exists inventory_items_category_check;

alter table public.inventory_items
  add constraint inventory_items_category_check check (
    length(trim(category)) between 1 and 120
    and category collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint inventory_items_category_check on public.inventory_items is
  'MISE-005GE: inventory_items category length(trim) 1..120 plus ASCII control rejection under COLLATE "C".';
