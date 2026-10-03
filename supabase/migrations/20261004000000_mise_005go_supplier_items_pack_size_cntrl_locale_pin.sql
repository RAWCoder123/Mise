-- MISE-005GO: pin public.supplier_items.pack_size CHECK to reject
-- control characters under COLLATE "C" and lock the pack-size label
-- length bound.
--
-- supplier_items.pack_size is durable nullable text
-- (restaurant_ops_backbone) with no table-level length or control-character
-- gate. supplier_items_operational_values_check only requires non-empty
-- supplier_name / item_name / unit and non-negative estimated_unit_cost; it
-- never mentions pack_size. purchase_lines.pack_size on main already gates
-- null OR length(btrim) 1..80 plus bare POSIX [[:cntrl:]]
-- (mise_004c_purchase_line_ledger) and hosted writers truncate pack labels
-- via private.purchase_line_text(..., 80). That is the bound signal for
-- this catalog pack-size label column. Bare POSIX [[:cntrl:]] follows
-- database LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved
-- locale drift on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- pack_size is a durable single-line vendor catalog pack-size label
-- (e.g. "10 lb case", "6/1 GAL", "12 pack") used for supplier catalog
-- display and pack-aware recommendations. It is not free-form multiline
-- prose and must not accept LF/TAB/CR/NUL. If LC_CTYPE drifted under a
-- bare (or missing) cntrl gate, dump/restore could accept pack_size bytes
-- a restored C-locale path would refuse — or the reverse — breaking
-- catalog pack-label continuity and pack-round recommendation display
-- across restore.
--
-- Scope:
--   - Attach supplier_items_pack_size_check as null OR
--     length(trim(pack_size)) between 1 and 80 PLUS ASCII control
--     rejection under COLLATE "C" (matches purchase_lines.pack_size
--     1..80 bound on main)
--   - Dedicated CHECK so this tip stays alone-OK versus
--     supplier_items_operational_values_check, supplier_sku (#603),
--     pack_quantity, canonical_unit (#491), verification_status, and
--     supplier_id_required_check
-- Does NOT rewrite purchase_line writers, supplier catalog read UI (#334),
-- pack-quantity verify (#291), supplier_sku (#603), item_name / unit /
-- supplier_name columns, or sibling supplier_items CHECKs.
-- Timestamp after MISE-005GN (#604).

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
        con.conname = 'supplier_items_pack_size_check'
        or (
          pg_get_constraintdef(con.oid) ~* '\ypack_size\y'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%pack_size%'
            or pg_get_constraintdef(con.oid) ilike '%length(pack_size)%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%supplier_name%'
          and pg_get_constraintdef(con.oid) not ilike '%item_name%'
          and pg_get_constraintdef(con.oid) not ilike '%supplier_sku%'
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
  drop constraint if exists supplier_items_pack_size_check;

alter table public.supplier_items
  add constraint supplier_items_pack_size_check check (
    pack_size is null
    or (
      length(trim(pack_size)) between 1 and 80
      and pack_size collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint supplier_items_pack_size_check
  on public.supplier_items is
  'MISE-005GO: supplier_items pack_size null or length(trim) 1..80 plus ASCII control rejection under COLLATE "C".';
