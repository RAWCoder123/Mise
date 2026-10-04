# MISE-005HG: inventory_events.source_reference cntrl locale pin

## Summary

Additive CHECK-only migration attaches
`inventory_events_source_reference_check` as
`source_reference is null or (length(trim(source_reference)) between 1 and 200
and source_reference collate "C" !~ '[[:cntrl:]]')`.

The foundation column was unbounded nullable `source_reference text` with no
control-character gate. Open #370 may already length-cap at 200 via
`char_length` plus a BEFORE INSERT trigger; this tip upgrades to a dedicated
null-or-length(trim) CHECK locked under COLLATE "C" so dump/restore cannot
accept inventory-ledger correlation bytes a restored C-locale path would
refuse.

`source_reference` is classified as a single-line correlation key
(e.g. delivery IDs, count session IDs), not free-form multiline prose.
Hosted writers already store `nullif(trim(p_source_reference), '')`.

## Scope

- CHECK-only; does not rewrite `record_inventory_event` or the #370 oversize
  trigger
- Drops any prior `inventory_events_source_reference_length_check` so one
  dedicated constraint owns the column
- Leaves source (#622), client_event_id / idempotency_key (#478), event_type
  (#492), and quantity/supersedes/canonical_unit/metadata CHECKs untouched
- Alone-OK versus open #622 / #478 / #492 / #370 (composes with #370's trigger
  when present; replaces its length-only CHECK when present)

## Verification

- `npm run typecheck` passed
- focused `inventoryEventsSourceReferenceCntrlLocalePin` 4/4 passed
- `npm test` 680 pass / 0 fail / 7 cancelled (pre-existing `recalculationCycles` withTimeout hang)
- pgTAP plan 14 from 14 assertion call sites (Docker/pgTAP unavailable in this environment)
