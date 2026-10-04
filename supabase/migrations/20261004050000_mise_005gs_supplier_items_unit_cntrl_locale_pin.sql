-- MISE-005GS: pin public.supplier_items.unit CHECK to reject
-- control characters under COLLATE "C" and lock the catalog unit
-- length bound.
--
-- supplier_items.unit is durable NOT NULL text
-- (restaurant_ops_backbone). supplier_items_operational_values_check only
-- requires length(trim(unit)) > 0 alongside supplier_name / item_name and
-- non-negative estimated_unit_cost; it has no upper length bound and no
-- control-character gate. inventory_items.unit /
-- purchase_recommendations.unit on main already gate length(trim) 1..40.
-- That is the bound signal for this vendor catalog unit-of-measure label.
-- Bare POSIX [[:cntrl:]] follows database LC_CTYPE; this cluster runs
-- libc en_US.UTF-8. MISE-005A proved locale drift on this cluster;
-- sibling tips re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'`.
--
-- unit is a durable single-line vendor catalog unit-of-measure label
-- (for example lb, case, ea) used for supplier catalog display, pack-aware
-- recommendations, and inventory linking. It is not free-form multiline
-- prose and must not accept LF/TAB/CR/NUL. If LC_CTYPE drifted under a bare
-- (or missing) cntrl gate, dump/restore could accept unit bytes a restored
-- C-locale path would refuse — or the reverse — breaking catalog unit
-- continuity across restore.
--
-- Scope:
--   - Attach supplier_items_unit_check as
--     length(trim(unit)) between 1 and 40 PLUS ASCII control
--     rejection under COLLATE "C" (matches inventory_items.unit
--     1..40 bound on main). Column is NOT NULL; no null OR branch.
--   - Dedicated CHECK so this tip stays alone-OK versus
--     supplier_items_operational_values_check (left intact; still
--     length>0 only), item_name (#608), supplier_sku (#603),
--     pack_size (#605), pack_quantity, canonical_unit (#491),
--     verification_status, and supplier_id_required_check
-- Does NOT rewrite supplier catalog read UI (#334), barcode SKU capture
-- (#218), pack-quantity verify (#291), operational_values_check, item_name /
-- supplier_name columns, or sibling supplier_items CHECKs.
-- Timestamp after MISE-005GR (#608).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.supplier_items'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'supplier_items_unit_check'
        or (
          pg_get_constraintdef(con.oid) ~* '\yunit\y'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%unit%'
            or pg_get_constraintdef(con.oid) ilike '%length(unit)%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%supplier_name%'
          and pg_get_constraintdef(con.oid) not ilike '%item_name%'
          and pg_get_constraintdef(con.oid) not ilike '%estimated_unit_cost%'
          and pg_get_constraintdef(con.oid) not ilike '%supplier_sku%'
          and pg_get_constraintdef(con.oid) not ilike '%pack_size%'
          and pg_get_constraintdef(con.oid) not ilike '%pack_quantity%'
          and pg_get_constraintdef(con.oid) not ilike '%canonical_unit%'
          and pg_get_constraintdef(con.oid) not ilike '%verification_status%'
          and pg_get_constraintdef(con.oid) not ilike '%supplier_id_required%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.supplier_items drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.supplier_items
  drop constraint if exists supplier_items_unit_check;

alter table public.supplier_items
  add constraint supplier_items_unit_check check (
    length(trim(unit)) between 1 and 40
    and unit collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint supplier_items_unit_check
  on public.supplier_items is
  'MISE-005GS: supplier_items unit length(trim) 1..40 plus ASCII control rejection under COLLATE "C".';
