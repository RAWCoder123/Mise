-- MISE-005EO: pin public.supplier_deliveries.notes and
-- public.supplier_delivery_items.discrepancy_reason CHECKs to reject
-- control characters under COLLATE "C".
--
-- Both columns only enforced length bounds:
--   supplier_deliveries_notes_bound_check:
--     notes is null or length(notes) <= 2000
--   supplier_delivery_items_reason_bound_check:
--     discrepancy_reason is null or length(discrepancy_reason) <= 500
-- They had no control-character gate. Bare POSIX [[:cntrl:]] follows
-- database LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved
-- locale drift on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- Delivery notes and discrepancy reasons are durable free-form operator
-- text on the supplier-delivery ledger. If LC_CTYPE drifted under a bare
-- (or missing) cntrl gate, dump/restore could accept note bytes a restored
-- C-locale path would refuse — or the reverse — breaking delivery-evidence
-- continuity across restore.
--
-- Scope:
--   - Reattach both CHECKs preserving the exact length() bounds PLUS
--     ASCII control rejection under COLLATE "C"
-- Does NOT rewrite record_supplier_order_delivery / delivery RPCs, delivery
-- status vocabulary, inventory count notes (#552), supplier_orders.operator_note
-- (#551), or insight body pins (#550).
-- Timestamp after MISE-005EN (#552).

alter table public.supplier_deliveries
  drop constraint if exists supplier_deliveries_notes_bound_check;

alter table public.supplier_deliveries
  add constraint supplier_deliveries_notes_bound_check check (
    notes is null
    or (
      length(notes) <= 2000
      and notes collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint supplier_deliveries_notes_bound_check on public.supplier_deliveries is
  'MISE-005EO: supplier delivery notes length <= 2000 plus ASCII control rejection under COLLATE "C".';

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

comment on constraint supplier_delivery_items_reason_bound_check on public.supplier_delivery_items is
  'MISE-005EO: supplier delivery discrepancy_reason length <= 500 plus ASCII control rejection under COLLATE "C".';
