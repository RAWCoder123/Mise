-- MISE-005JB: pin public.supplier_deliveries.notes to reject unsafe
-- control characters under COLLATE "C", while allowing multiline notes.
--
-- public.supplier_deliveries.notes was declared nullable text with a
-- length-only bound (operational backend foundation 20260802204120):
--   notes is null or length(notes) <= 2000
-- (constraint supplier_deliveries_notes_bound_check). No control-character
-- gate existed.
--
-- Sibling receive-line tip MISE-005IS (#661) pinned discrepancy_reason with
-- full ASCII C [[:cntrl:]]. Delivery header notes are free-form receive
-- evidence that may include line breaks (same shape as
-- supplier_orders.operator_note / MISE-005EM #551). Bare POSIX [[:cntrl:]]
-- would reject LF and break legitimate multiline notes, so this tip uses
-- the same byte class as services/miseValidation.ts
-- `unsafeSupplierSendMultilineControlPattern` and MISE-005EM:
--   reject U+0000–U+0008, U+000B, U+000C, U+000E–U+001F, U+007F
--   allow LF (U+000A), TAB (U+0009), and CR (U+000D)
--
-- notes is durable optional receive evidence. Authenticated clients hold
-- SELECT; writes go through SECURITY DEFINER receive RPCs that
-- nullif(trim(p_notes), '') and length-check <= 2000. POSIX character
-- classes follow database LC_CTYPE. This cluster runs libc en_US.UTF-8.
-- MISE-005A proved locale drift on this cluster.
--
-- If LC_CTYPE drifted under a bare length-only gate, dump/restore could
-- accept notes bytes a restored C-locale sibling note gate would refuse —
-- or the reverse — breaking receive evidence continuity across restore.
--
-- Scope:
--   - Reattach supplier_deliveries_notes_bound_check preserving exact
--     nullability + length(notes) <= 2000 PLUS multiline-aware ASCII
--     control rejection under COLLATE "C"
-- Does NOT rewrite receive RPCs, supplier_delivery_items.discrepancy_reason
-- (#661), client_delivery_id (#458), supplier_orders.operator_note (#551),
-- or supplier_deliveries.status (#514).
-- Timestamp after MISE-005IY (#667).

alter table public.supplier_deliveries
  drop constraint if exists supplier_deliveries_notes_bound_check;

alter table public.supplier_deliveries
  add constraint supplier_deliveries_notes_bound_check check (
    notes is null
    or (
      length(notes) <= 2000
      and notes collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
    )
  );

comment on constraint supplier_deliveries_notes_bound_check
  on public.supplier_deliveries is
  'MISE-005JB: notes null or length <= 2000 plus multiline-aware ASCII control rejection under COLLATE "C" (allows LF/TAB/CR; rejects other C0 controls and DEL).';
