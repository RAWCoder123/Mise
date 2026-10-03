-- MISE-005FX: pin public.purchase_recommendations.item_name CHECK to reject
-- control characters under COLLATE "C".
--
-- purchase_recommendations_operational_values_check
-- (harden_workflow_authority) already enforces
-- length(trim(item_name)) between 1 and 160 alongside supplier_name, unit,
-- reason, and recommended_quantity bounds. It had no control-character gate
-- on item_name. Bare POSIX [[:cntrl:]] follows database LC_CTYPE; this
-- cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- item_name is a durable single-line purchase-recommendation label
-- (operator-facing display name snapshot copied from the inventory item).
-- It is not free-form multiline prose and must not accept LF/TAB/CR/NUL.
-- If LC_CTYPE drifted under a bare (or missing) cntrl gate, dump/restore
-- could accept item_name bytes a restored C-locale path would refuse — or
-- the reverse — breaking purchase-recommendation continuity across restore.
--
-- Scope:
--   - Reattach purchase_recommendations_operational_values_check preserving
--     the exact length and quantity bounds PLUS ASCII control rejection on
--     item_name under COLLATE "C"
-- Does NOT rewrite recommendation writers, tip supplier_name / unit /
-- reason cntrl (leave for sibling tips; reason is longer free-form prose),
-- inventory_items tips (#585–#587), pos_sales.item_name, or
-- inventory_count_lines.item_name.
-- Timestamp after MISE-005FW (#587). Alone-OK vs inventory_items stack.

alter table public.purchase_recommendations
  drop constraint if exists purchase_recommendations_operational_values_check;

alter table public.purchase_recommendations
  add constraint purchase_recommendations_operational_values_check check (
    length(trim(item_name)) between 1 and 160
    and item_name collate "C" !~ '[[:cntrl:]]'
    and length(trim(supplier_name)) between 1 and 160
    and length(trim(unit)) between 1 and 40
    and length(trim(reason)) between 1 and 2000
    and recommended_quantity > 0
    and recommended_quantity <= 1000000
  );

comment on constraint purchase_recommendations_operational_values_check on public.purchase_recommendations is
  'MISE-005FX: purchase recommendation operational bounds plus item_name ASCII control rejection under COLLATE "C".';
