-- MISE-005FZ: pin public.purchase_recommendations.unit CHECK to reject
-- control characters under COLLATE "C".
--
-- purchase_recommendations_operational_values_check
-- (harden_workflow_authority) already enforces
-- length(trim(unit)) between 1 and 40 alongside item_name, supplier_name,
-- reason, and recommended_quantity bounds. MISE-005FX (#588) pinned
-- item_name and MISE-005FY (#589) pinned supplier_name ASCII control
-- rejection under COLLATE "C". unit remained length-only. Bare POSIX
-- [[:cntrl:]] follows database LC_CTYPE; this cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; sibling
-- tips re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'`.
--
-- unit is a durable single-line purchase-recommendation label
-- (operator-facing unit-of-measure snapshot). It is not free-form
-- multiline prose and must not accept LF/TAB/CR/NUL. If LC_CTYPE drifted
-- under a bare (or missing) cntrl gate, dump/restore could accept unit
-- bytes a restored C-locale path would refuse — or the reverse —
-- breaking purchase-recommendation continuity across restore.
--
-- Scope:
--   - Reattach purchase_recommendations_operational_values_check preserving
--     the exact length and quantity bounds PLUS MISE-005FX item_name cntrl
--     PLUS MISE-005FY supplier_name cntrl PLUS ASCII control rejection on
--     unit under COLLATE "C"
-- Does NOT rewrite recommendation writers, tip reason cntrl (longer
-- free-form prose; use operator_note-style allowlist if tipped later),
-- inventory_items tips (#585–#587), pos_sales.item_name, or
-- inventory_count_lines.item_name.
-- Timestamp after MISE-005FY (#589). Alone-OK vs inventory_items stack.

alter table public.purchase_recommendations
  drop constraint if exists purchase_recommendations_operational_values_check;

alter table public.purchase_recommendations
  add constraint purchase_recommendations_operational_values_check check (
    length(trim(item_name)) between 1 and 160
    and item_name collate "C" !~ '[[:cntrl:]]'
    and length(trim(supplier_name)) between 1 and 160
    and supplier_name collate "C" !~ '[[:cntrl:]]'
    and length(trim(unit)) between 1 and 40
    and unit collate "C" !~ '[[:cntrl:]]'
    and length(trim(reason)) between 1 and 2000
    and recommended_quantity > 0
    and recommended_quantity <= 1000000
  );

comment on constraint purchase_recommendations_operational_values_check on public.purchase_recommendations is
  'MISE-005FZ: purchase recommendation operational bounds plus item_name, supplier_name, and unit ASCII control rejection under COLLATE "C".';
