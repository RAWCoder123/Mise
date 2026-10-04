-- MISE-005GR: pin public.supplier_items.item_name CHECK to reject
-- control characters under COLLATE "C" and lock the catalog item-name
-- length bound.
--
-- supplier_items.item_name is durable NOT NULL text
-- (restaurant_ops_backbone). supplier_items_operational_values_check only
-- requires length(trim(item_name)) > 0 alongside supplier_name / unit and
-- non-negative estimated_unit_cost; it has no upper length bound and no
-- control-character gate. inventory_items.item_name /
-- purchase_recommendations.item_name / inventory_count_lines.item_name on
-- main already gate length(trim) 1..160 (or char_length(btrim) 1..160).
-- That is the bound signal for this vendor catalog item-name label.
-- Bare POSIX [[:cntrl:]] follows database LC_CTYPE; this cluster runs
-- libc en_US.UTF-8. MISE-005A proved locale drift on this cluster;
-- sibling tips re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'`.
--
-- item_name is a durable single-line vendor catalog product label used for
-- supplier catalog display, pack-aware recommendations, and inventory
-- linking. It is not free-form multiline prose and must not accept
-- LF/TAB/CR/NUL. If LC_CTYPE drifted under a bare (or missing) cntrl
-- gate, dump/restore could accept item_name bytes a restored C-locale
-- path would refuse — or the reverse — breaking catalog item-name
-- continuity across restore.
--
-- Scope:
--   - Attach supplier_items_item_name_check as
--     length(trim(item_name)) between 1 and 160 PLUS ASCII control
--     rejection under COLLATE "C" (matches inventory_items.item_name
--     1..160 bound on main). Column is NOT NULL; no null OR branch.
--   - Dedicated CHECK so this tip stays alone-OK versus
--     supplier_items_operational_values_check (left intact; still
--     length>0 only), supplier_sku (#603), pack_size (#605),
--     pack_quantity, canonical_unit (#491), verification_status, and
--     supplier_id_required_check
-- Does NOT rewrite supplier catalog read UI (#334), barcode SKU capture
-- (#218), pack-quantity verify (#291), operational_values_check, unit /
-- supplier_name columns, or sibling supplier_items CHECKs.
-- Timestamp after MISE-005GQ (#607).

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
        con.conname = 'supplier_items_item_name_check'
        or (
          pg_get_constraintdef(con.oid) ~* '\yitem_name\y'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%item_name%'
            or pg_get_constraintdef(con.oid) ilike '%length(item_name)%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%supplier_name%'
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
  drop constraint if exists supplier_items_item_name_check;

alter table public.supplier_items
  add constraint supplier_items_item_name_check check (
    length(trim(item_name)) between 1 and 160
    and item_name collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint supplier_items_item_name_check
  on public.supplier_items is
  'MISE-005GR: supplier_items item_name length(trim) 1..160 plus ASCII control rejection under COLLATE "C".';
