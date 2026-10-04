# MISE-005HH: inventory_events.reason_code cntrl locale pin

## Summary

Additive CHECK-only migration attaches
`inventory_events_reason_code_check` as
`reason_code is null or (length(trim(reason_code)) between 1 and 80
and reason_code collate "C" !~ '[[:cntrl:]]')`.

The foundation column was unbounded nullable `reason_code text` with no
control-character gate. Open #368 may already length-cap at 80 via
`char_length` plus a `record_inventory_event` oversize rewrite; this tip
upgrades to a dedicated null-or-length(trim) CHECK locked under COLLATE "C"
so dump/restore cannot accept inventory-ledger reason bytes a restored
C-locale path would refuse.

`reason_code` is classified as a single-line ledger evidence label
(e.g. `cycle_count`, `demo_closeout`), not free-form multiline prose.
Hosted writers already store `nullif(trim(p_reason_code), '')`.

## Scope

- CHECK-only; does not rewrite `record_inventory_event`
- Drops any prior `inventory_events_reason_code_length_check` so one
  dedicated constraint owns the column
- Leaves source (#622), source_reference (#623), client_event_id /
  idempotency_key (#478), event_type (#492), and
  quantity/supersedes/canonical_unit/metadata CHECKs untouched
- Does not touch private operational/pilot `reason_code` pins (#448)
- Alone-OK versus open #622 / #623 / #478 / #492 / #368 (composes with
  #368's RPC rewrite when present; replaces its length-only CHECK when
  present)

## Verification

- `npm run typecheck` passed
- focused `inventoryEventsReasonCodeCntrlLocalePin` 4/4 passed
- `npm test` 680 pass / 0 fail / 7 cancelled (pre-existing `recalculationCycles` withTimeout hang)
- pgTAP plan 14 from 14 assertion call sites (Docker/pgTAP unavailable in this environment)
