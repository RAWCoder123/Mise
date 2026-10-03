-- MISE-005FU: pin public.inventory_items.item_name CHECK to reject
-- control characters under COLLATE "C".
--
-- inventory_items_operational_values_check (harden_workflow_authority)
-- already enforces length(trim(item_name)) between 1 and 160 alongside
-- unit, supplier_name, and quantity bounds. It had no control-character
-- gate on item_name. Bare POSIX [[:cntrl:]] follows database LC_CTYPE;
-- this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on
-- this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- item_name is a durable single-line inventory label (operator-facing
-- product name). It is not free-form multiline prose and must not accept
-- LF/TAB/CR/NUL. If LC_CTYPE drifted under a bare (or missing) cntrl
-- gate, dump/restore could accept item_name bytes a restored C-locale
-- path would refuse — or the reverse — breaking inventory continuity
-- across restore.
--
-- Scope:
--   - Reattach inventory_items_operational_values_check preserving the
--     exact length and numeric bounds PLUS ASCII control rejection on
--     item_name under COLLATE "C"
-- Does NOT rewrite setup/save inventory writers, unit/supplier_name
-- cntrl (leave for sibling tips), category, canonical_unit (#490/#491),
-- inventory count notes (#552), or purchase_recommendations.item_name.
-- Timestamp after MISE-005FT (#584).

alter table public.inventory_items
  drop constraint if exists inventory_items_operational_values_check;

alter table public.inventory_items
  add constraint inventory_items_operational_values_check check (
    length(trim(item_name)) between 1 and 160
    and item_name collate "C" !~ '[[:cntrl:]]'
    and length(trim(unit)) between 1 and 40
    and length(trim(supplier_name)) between 1 and 160
    and current_quantity between 0 and 1000000
    and par_level between 0 and 1000000
    and reorder_threshold between 0 and 1000000
    and estimated_unit_cost between 0 and 1000000
  );

comment on constraint inventory_items_operational_values_check on public.inventory_items is
  'MISE-005FU: inventory item operational bounds plus item_name ASCII control rejection under COLLATE "C".';
