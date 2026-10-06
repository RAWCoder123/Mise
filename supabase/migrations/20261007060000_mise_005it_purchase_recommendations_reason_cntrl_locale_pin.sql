-- MISE-005IT: pin public.purchase_recommendations.reason CHECK to reject
-- unsafe control characters under COLLATE "C", while allowing multiline
-- recommendation prose.
--
-- purchase_recommendations_operational_values_check
-- (harden_workflow_authority) already enforces
-- length(trim(reason)) between 1 and 2000 alongside item_name, supplier_name,
-- unit, and recommended_quantity bounds. MISE-005FX (#588) pinned item_name,
-- MISE-005FY (#589) pinned supplier_name, and MISE-005FZ (#590) pinned unit
-- ASCII control rejection under COLLATE "C" with full [[:cntrl:]]. reason
-- remained length-only. Bare POSIX [[:cntrl:]] follows database LC_CTYPE;
-- this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster.
--
-- reason is durable free-form purchase-recommendation prose (why Mise
-- recommended the quantity). It may include LF/TAB/CR like operator notes
-- and supplier-send multiline bodies, so this tip uses the same byte class
-- as services/miseValidation.ts `unsafeSupplierSendMultilineControlPattern`
-- and MISE-005EM operator_note:
--   reject U+0000–U+0008, U+000B, U+000C, U+000E–U+001F, U+007F
--   allow LF (U+000A), TAB (U+0009), and CR (U+000D)
-- If LC_CTYPE drifted under a bare (or missing) cntrl gate, dump/restore
-- could accept reason bytes a restored C-locale path would refuse — or the
-- reverse — breaking purchase-recommendation continuity across restore.
--
-- Scope:
--   - Reattach purchase_recommendations_operational_values_check preserving
--     the exact length and quantity bounds PLUS MISE-005FX item_name cntrl
--     PLUS MISE-005FY supplier_name cntrl PLUS MISE-005FZ unit cntrl PLUS
--     multiline-aware ASCII control rejection on reason under COLLATE "C"
-- Does NOT rewrite recommendation writers, tip inventory_items (#585–#587),
-- pos_sales.item_name, inventory_count_lines.item_name, or supplier_orders
-- operator_note (#551).
-- Timestamp after MISE-005FZ (#590) / MISE-005IS (#661). Land after #590 so
-- the shared CHECK reattach preserves item_name + supplier_name + unit pins.

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
    and reason collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
    and recommended_quantity > 0
    and recommended_quantity <= 1000000
  );

comment on constraint purchase_recommendations_operational_values_check on public.purchase_recommendations is
  'MISE-005IT: purchase recommendation operational bounds plus item_name, supplier_name, and unit ASCII control rejection under COLLATE "C", plus reason multiline-aware ASCII control rejection under COLLATE "C" (allows LF/TAB/CR; rejects other C0 controls and DEL).';
