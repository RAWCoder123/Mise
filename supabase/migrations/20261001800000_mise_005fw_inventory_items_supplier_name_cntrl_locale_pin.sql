-- MISE-005FW: pin public.inventory_items.supplier_name CHECK to reject
-- control characters under COLLATE "C".
--
-- inventory_items_operational_values_check (harden_workflow_authority)
-- already enforces length(trim(supplier_name)) between 1 and 160 alongside
-- item_name, unit, and quantity bounds. MISE-005FU (#585) pinned item_name
-- ASCII control rejection under COLLATE "C". MISE-005FV (#586) pinned unit
-- the same way. supplier_name remained length-only. Bare POSIX [[:cntrl:]]
-- follows database LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A
-- proved locale drift on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- supplier_name is a durable single-line inventory preferred-supplier label
-- (operator-facing display name snapshot on the item). Writers trim and
-- length-gate it (save_restaurant_setup / inventory patch paths bound
-- 1..160; client requireSupplierDisplayName also rejects controls) without a
-- table-level cntrl gate. It is not free-form multiline prose and must not
-- accept LF/TAB/CR/NUL. If LC_CTYPE drifted under a bare (or missing) cntrl
-- gate, dump/restore could accept supplier_name bytes a restored C-locale
-- path would refuse — or the reverse — breaking inventory continuity across
-- restore.
--
-- Scope:
--   - Reattach inventory_items_operational_values_check preserving the
--     exact length and numeric bounds PLUS MISE-005FU item_name cntrl
--     PLUS MISE-005FV unit cntrl PLUS ASCII control rejection on
--     supplier_name under COLLATE "C"
-- Does NOT rewrite setup/save inventory writers, category, canonical_unit
-- (#490/#491), inventory count notes (#552), or purchase_recommendations /
-- pos_sales / inventory_count_lines item_name tips.
-- Timestamp after MISE-005FV (#586).

alter table public.inventory_items
  drop constraint if exists inventory_items_operational_values_check;

alter table public.inventory_items
  add constraint inventory_items_operational_values_check check (
    length(trim(item_name)) between 1 and 160
    and item_name collate "C" !~ '[[:cntrl:]]'
    and length(trim(unit)) between 1 and 40
    and unit collate "C" !~ '[[:cntrl:]]'
    and length(trim(supplier_name)) between 1 and 160
    and supplier_name collate "C" !~ '[[:cntrl:]]'
    and current_quantity between 0 and 1000000
    and par_level between 0 and 1000000
    and reorder_threshold between 0 and 1000000
    and estimated_unit_cost between 0 and 1000000
  );

comment on constraint inventory_items_operational_values_check on public.inventory_items is
  'MISE-005FW: inventory item operational bounds plus item_name, unit, and supplier_name ASCII control rejection under COLLATE "C".';
