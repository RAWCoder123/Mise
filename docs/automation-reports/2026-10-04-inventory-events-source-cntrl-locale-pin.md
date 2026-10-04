# MISE-005HF: inventory_events.source cntrl locale pin

## Summary

Additive CHECK-only migration reattaches
`inventory_events_source_check` as
`length(trim(source)) between 1 and 80` plus
`source collate "C" !~ '[[:cntrl:]]'`.

The foundation column was `source text not null check (length(trim(source)) between 1 and 80)`
with no control-character gate. Hosted `public.record_inventory_event`
already stores `trim(p_source)` and the CHECK enforces the 80 ceiling.
This tip locks that length bound under COLLATE "C" so dump/restore cannot
accept inventory-ledger source label bytes a restored C-locale path would
refuse.

`source` is classified as a single-line system/integration label
(e.g. `manual`, `pos`, `count_session`), not free-form multiline prose.

## Scope

- CHECK-only; does not rewrite `record_inventory_event`
- Leaves client_event_id / idempotency_key (#478), event_type (#492),
  source_reference (#370), and quantity/supersedes/canonical_unit/metadata
  CHECKs untouched
- Alone-OK versus open #478 / #492 / #370 (different columns on the same table)

## Verification

- `npm run typecheck` passed
- focused `inventoryEventsSourceCntrlLocalePin` 4/4 passed
- `npm test` 680 pass / 0 fail / 7 cancelled (pre-existing `recalculationCycles` withTimeout hang)
- pgTAP plan 14 from 14 assertion call sites (Docker/pgTAP unavailable in this environment)
