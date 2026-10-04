-- MISE-005GU: pin public.purchase_orders.supplier_name CHECK to reject
-- control characters under COLLATE "C" and lock the purchase-order
-- supplier-name length bound.
--
-- purchase_orders.supplier_name is durable NOT NULL text
-- (restaurant_ops_backbone). purchase_orders_operational_values_check only
-- requires length(trim(supplier_name)) > 0 alongside non-negative
-- subtotal_estimate; it has no upper length bound and no
-- control-character gate. inventory_items.supplier_name /
-- purchase_recommendations.supplier_name on main already gate
-- length(trim) 1..160. That is the bound signal for this purchase-order
-- supplier-name snapshot label. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale
-- drift on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- supplier_name is a durable single-line purchase-order supplier display
-- snapshot used for operator review and historical readability after
-- MISE-003C durable supplier_id authority. It is not free-form multiline
-- prose and must not accept LF/TAB/CR/NUL. If LC_CTYPE drifted under a
-- bare (or missing) cntrl gate, dump/restore could accept supplier_name
-- bytes a restored C-locale path would refuse — or the reverse —
-- breaking purchase-order supplier-name continuity across restore.
--
-- Scope:
--   - Attach purchase_orders_supplier_name_check as
--     length(trim(supplier_name)) between 1 and 160 PLUS ASCII control
--     rejection under COLLATE "C" (matches inventory_items.supplier_name
--     1..160 bound on main). Column is NOT NULL; no null OR branch.
--   - Dedicated CHECK so this tip stays alone-OK versus
--     purchase_orders_operational_values_check (left intact; still
--     length>0 only), supplier_id_required_check, status, and
--     subtotal_estimate bounds
-- Does NOT rewrite purchase-order writers, durable supplier_id authority
-- (MISE-003C), operational_values_check, or sibling purchase_orders
-- CHECKs.
-- Timestamp after MISE-005GT (#610).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.purchase_orders'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'purchase_orders_supplier_name_check'
        or (
          pg_get_constraintdef(con.oid) ~* '\ysupplier_name\y'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%supplier_name%'
            or pg_get_constraintdef(con.oid) ilike '%length(supplier_name)%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%subtotal_estimate%'
          and pg_get_constraintdef(con.oid) not ilike '%supplier_id%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
          and pg_get_constraintdef(con.oid) not ilike '%order_payload%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.purchase_orders drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.purchase_orders
  drop constraint if exists purchase_orders_supplier_name_check;

alter table public.purchase_orders
  add constraint purchase_orders_supplier_name_check check (
    length(trim(supplier_name)) between 1 and 160
    and supplier_name collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint purchase_orders_supplier_name_check
  on public.purchase_orders is
  'MISE-005GU: purchase_orders supplier_name length(trim) 1..160 plus ASCII control rejection under COLLATE "C".';
