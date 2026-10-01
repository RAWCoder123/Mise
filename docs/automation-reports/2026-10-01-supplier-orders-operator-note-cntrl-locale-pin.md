# MISE-005EM supplier_orders.operator_note multiline cntrl locale pin

Date: 2026-10-01

## Change

CHECK-only replace of `supplier_orders_operator_note_length_check` preserving:

- nullability (`operator_note is null` allowed)
- exact length bound `length(operator_note) <= 2000`

plus multiline-aware ASCII control rejection under `COLLATE "C"`:

- reject U+0000–U+0008, U+000B, U+000C, U+000E–U+001F, U+007F
- allow LF (U+000A), TAB (U+0009), and CR (U+000D) — matching
  `unsafeSupplierSendMultilineControlPattern` in `services/miseValidation.ts`

Client `requireSupplierOperatorNote` now rejects the same unsafe control set
before a round-trip, while still accepting newline-containing notes.

## Why

The original length CHECK had no control-character gate. Operator notes are
durable free-form supplier-order text appended into send bodies. A bare
`[[:cntrl:]]` gate would also reject legitimate newlines. Sibling MISE-005 tips
pin text CHECKs under `COLLATE "C"` so dump/restore cannot accept bytes a
restored C-locale path would refuse.

## Out of scope

- Supplier-send builder / draft-update RPC rewrites
- `order_message` size CHECK
- `provider_message_id` (#445)
- Insight body pins (#550)

## Verification

- `npm run typecheck` — passed
- focused `supplierOrdersOperatorNoteCntrlLocalePin` tests — 4/4 pass
- `npm test` — 680 pass / 0 fail / 7 cancelled (inherited)
- pgTAP plan **14** counted from 14 assertion call sites in
  `supplier_orders_operator_note_cntrl_locale_pin.test.sql`
