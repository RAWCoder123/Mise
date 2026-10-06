-- MISE-005IS: pin public.supplier_delivery_items.discrepancy_reason length +
-- cntrl CHECK to COLLATE "C".
--
-- public.supplier_delivery_items.discrepancy_reason was declared nullable text
-- with a length-only bound (operational backend foundation 20260802204120):
--   discrepancy_reason is null or length(discrepancy_reason) <= 500
-- (constraint supplier_delivery_items_reason_bound_check). No control-character
-- gate existed. Sibling receive-path tip MISE-005AZ-era client_delivery_id
-- (#458) pinned delivery identity; inventory_events.reason_code (#624) and
-- mise_actions.reason (#579) already pin operator/system reason text under
-- COLLATE "C". Delivery-line discrepancy_reason remained length-only.
--
-- discrepancy_reason is the durable optional single-line explanation for a
-- damaged/missing/substituted receive line. Authenticated clients hold SELECT;
-- writes go through SECURITY DEFINER receive RPCs that trim and left(..., 500)
-- the JSON discrepancyReason. POSIX character classes follow database
-- LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster.
--
-- If LC_CTYPE drifted under a bare length-only gate, dump/restore could accept
-- discrepancy_reason bytes a restored C-locale sibling reason gate would
-- refuse — or the reverse — breaking receive discrepancy continuity and
-- supplier reliability learning across restore.
--
-- Scope:
--   - Reattach supplier_delivery_items_reason_bound_check preserving exact
--     nullability + length(discrepancy_reason) <= 500 PLUS ASCII control
--     rejection under COLLATE "C"
-- Does NOT rewrite receive RPCs, supplier_deliveries.notes, client_delivery_id
-- (#458), inventory_events.reason_code (#624), mise_actions.reason (#579), or
-- canonical_unit enum pins.
-- Timestamp after MISE-005IR (#660).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.supplier_delivery_items'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'supplier_delivery_items_reason_bound_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%discrepancy_reason%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%discrepancy_reason%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.supplier_delivery_items drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.supplier_delivery_items
  drop constraint if exists supplier_delivery_items_reason_bound_check;

alter table public.supplier_delivery_items
  add constraint supplier_delivery_items_reason_bound_check check (
    discrepancy_reason is null
    or (
      length(discrepancy_reason) <= 500
      and discrepancy_reason collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint supplier_delivery_items_reason_bound_check
  on public.supplier_delivery_items is
  'MISE-005IS: discrepancy_reason null or length <= 500 plus ASCII control rejection under COLLATE "C".';
