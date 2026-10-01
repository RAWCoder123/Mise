# MISE-005EN inventory count session/line note cntrl locale pin

Date: 2026-10-01

## Change

CHECK-only replace of:

- `inventory_count_sessions_note_check` — keep `char_length(note) <= 240`, add
  `note collate "C" !~ '[[:cntrl:]]'`
- `inventory_count_lines_note_check` — keep `char_length(note) <= 240`, add
  `note collate "C" !~ '[[:cntrl:]]'`

Client validators `requireInventoryCountSessionNote` and
`requireInventoryCountLineNote` now reject the same ASCII C control set
(`U+0000–U+001F`, `U+007F`) before a round-trip.

## Why

Both note CHECKs had length only and no control-character gate. Count session
and line notes are durable free-form operator text on the inventory count
ledger. Sibling MISE-005 tips pin text CHECKs under `COLLATE "C"` so
dump/restore cannot accept bytes a restored C-locale path would refuse.

## Out of scope

- count-session RPC / writer rewrites
- inventory_count_sessions.status (#495)
- item_name / unit bounds
- supplier_deliveries.notes / discrepancy_reason
- supplier_orders.operator_note (#551)

## Verification

- `npm run typecheck`
- focused `inventoryCountNotesCntrlLocalePin` tests: 5/5 pass
- `npm test`: 681 pass / 0 fail / 7 cancelled
- pgTAP plan **16** counted from 16 assertion call sites in
  `inventory_count_notes_cntrl_locale_pin.test.sql`
