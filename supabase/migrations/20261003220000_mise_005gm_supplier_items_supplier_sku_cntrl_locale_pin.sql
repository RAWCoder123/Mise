-- MISE-005GM: pin public.supplier_items.supplier_sku CHECK to reject
-- control characters under COLLATE "C" and lock the vendor SKU / barcode
-- length bound.
--
-- supplier_items.supplier_sku is durable nullable text
-- (restaurant_ops_backbone) with no table-level length or control-character
-- gate. supplier_items_operational_values_check only requires non-empty
-- supplier_name / item_name / unit and non-negative estimated_unit_cost; it
-- never mentions supplier_sku. Open manager-authority barcode capture
-- writers (#218) reject empty SKUs and refuse length > 64 after btrim
-- (INVENTORY_BARCODE_SKU_MAX_CHARACTERS = 64) plus bare POSIX [[:cntrl:]]
-- before update/insert, but do not yet land a table CHECK and are not on
-- main. Bare POSIX [[:cntrl:]] follows database LC_CTYPE; this cluster
-- runs libc en_US.UTF-8. MISE-005A proved locale drift on this cluster;
-- sibling tips re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'`.
--
-- supplier_sku is a durable single-line vendor catalog SKU / barcode label
-- used for inventory linking and supplier catalog display. It is not
-- free-form multiline prose and must not accept LF/TAB/CR/NUL. If LC_CTYPE
-- drifted under a bare (or missing) cntrl gate, dump/restore could accept
-- supplier_sku bytes a restored C-locale path would refuse — or the reverse
-- — breaking barcode→inventory matching and catalog SKU continuity across
-- restore.
--
-- Scope:
--   - Attach supplier_items_supplier_sku_check as null OR
--     length(trim(supplier_sku)) between 1 and 64 PLUS ASCII control
--     rejection under COLLATE "C" (matches open #218 writer bound)
--   - Dedicated CHECK so this tip stays alone-OK versus
--     supplier_items_operational_values_check, pack_quantity (#218 siblings),
--     canonical_unit (#491), verification_status, and
--     supplier_id_required_check
-- Does NOT rewrite capture_inventory_item_supplier_sku (#218), supplier
-- catalog read UI (#334), pack_size / item_name / unit / supplier_name
-- columns, or sibling supplier_items CHECKs.
-- Timestamp after MISE-005GL (#602).

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
        con.conname = 'supplier_items_supplier_sku_check'
        or (
          pg_get_constraintdef(con.oid) ~* '\ysupplier_sku\y'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%supplier_sku%'
            or pg_get_constraintdef(con.oid) ilike '%length(supplier_sku)%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%supplier_name%'
          and pg_get_constraintdef(con.oid) not ilike '%item_name%'
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
  drop constraint if exists supplier_items_supplier_sku_check;

alter table public.supplier_items
  add constraint supplier_items_supplier_sku_check check (
    supplier_sku is null
    or (
      length(trim(supplier_sku)) between 1 and 64
      and supplier_sku collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint supplier_items_supplier_sku_check
  on public.supplier_items is
  'MISE-005GM: supplier_items supplier_sku null or length(trim) 1..64 plus ASCII control rejection under COLLATE "C".';
