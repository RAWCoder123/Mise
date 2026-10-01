-- MISE-005EM: pin public.supplier_orders.operator_note to reject unsafe
-- control characters under COLLATE "C", while allowing multiline notes.
--
-- supplier_orders_operator_note_length_check only enforced
-- `operator_note is null or length(operator_note) <= 2000`. It had no
-- control-character gate. Bare POSIX [[:cntrl:]] would also reject LF
-- (and the supplier-send multiline allowlist), so this tip uses the same
-- byte class as services/miseValidation.ts
-- `unsafeSupplierSendMultilineControlPattern`:
--   reject U+0000–U+0008, U+000B, U+000C, U+000E–U+001F, U+007F
--   allow LF (U+000A), and also TAB (U+0009) / CR (U+000D) for parity
--   with the established supplier-send multiline control pattern.
--
-- Operator notes are durable free-form supplier-order text that is
-- appended into send bodies. If LC_CTYPE drifted under a bare (or
-- missing) cntrl gate, dump/restore could accept note bytes a restored
-- C-locale path would refuse — or the reverse — breaking order-content
-- continuity across restore.
--
-- Scope:
--   - Reattach supplier_orders_operator_note_length_check preserving the
--     exact length bound PLUS multiline-aware ASCII control rejection
--     under COLLATE "C"
-- Does NOT rewrite supplier-send builders, draft-update RPCs,
-- order_message size CHECK, provider_message_id (#445), or insight body
-- pins (#550).
-- Timestamp after MISE-005EL (#550).

alter table public.supplier_orders
  drop constraint if exists supplier_orders_operator_note_length_check;

alter table public.supplier_orders
  add constraint supplier_orders_operator_note_length_check check (
    operator_note is null
    or (
      length(operator_note) <= 2000
      and operator_note collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
    )
  );

comment on constraint supplier_orders_operator_note_length_check on public.supplier_orders is
  'MISE-005EM: operator_note length <= 2000 plus multiline-aware ASCII control rejection under COLLATE "C" (allows LF/TAB/CR; rejects other C0 controls and DEL).';
