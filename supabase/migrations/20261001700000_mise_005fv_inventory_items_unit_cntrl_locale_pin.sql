-- MISE-005FV: pin public.inventory_items.unit CHECK to reject
-- control characters under COLLATE "C".
--
-- inventory_items_operational_values_check (harden_workflow_authority)
-- already enforces length(trim(unit)) between 1 and 40 alongside
-- item_name, supplier_name, and quantity bounds. MISE-005FU (#585)
-- added item_name ASCII control rejection under COLLATE "C" but left
-- unit length-only. Bare POSIX [[:cntrl:]] follows database LC_CTYPE;
-- this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on
-- this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- unit is a durable single-line inventory unit-of-measure label
-- (for example lb, case, ea). Writers trim and length-gate it
-- (save_restaurant_setup / inventory setup paths bound 1..40) without a
-- table-level cntrl gate. It is not free-form multiline prose and must
-- not accept LF/TAB/CR/NUL. If LC_CTYPE drifted under a bare (or missing)
-- cntrl gate, dump/restore could accept unit bytes a restored C-locale
-- path would refuse — or the reverse — breaking inventory continuity
-- across restore.
--
-- Scope:
--   - Reattach inventory_items_operational_values_check preserving the
--     exact length and numeric bounds PLUS MISE-005FU item_name cntrl
--     PLUS ASCII control rejection on unit under COLLATE "C"
-- Does NOT pin supplier_name cntrl (leave for a sibling tip), rewrite
-- setup/save inventory writers, category, canonical_unit (#490/#491),
-- inventory count notes (#552), or purchase_recommendations.item_name.
-- Timestamp after MISE-005FU (#585).

alter table public.inventory_items
  drop constraint if exists inventory_items_operational_values_check;

alter table public.inventory_items
  add constraint inventory_items_operational_values_check check (
    length(trim(item_name)) between 1 and 160
    and item_name collate "C" !~ '[[:cntrl:]]'
    and length(trim(unit)) between 1 and 40
    and unit collate "C" !~ '[[:cntrl:]]'
    and length(trim(supplier_name)) between 1 and 160
    and current_quantity between 0 and 1000000
    and par_level between 0 and 1000000
    and reorder_threshold between 0 and 1000000
    and estimated_unit_cost between 0 and 1000000
  );

comment on constraint inventory_items_operational_values_check on public.inventory_items is
  'MISE-005FV: inventory item operational bounds plus item_name and unit ASCII control rejection under COLLATE "C".';
