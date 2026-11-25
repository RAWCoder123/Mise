# Unsupported inventory correction source allowlist

Date: 2026-11-25  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-correction-source-allowlist-main`

## Gap

`record_inventory_event` accepted any trimmed `p_source` for `correction` rows.
Production writers (#345 waste correction, #350 receipt correction) stamp
`operator_correction`. A manager JWT could mint `manual`, `demo_correction`,
`Operator_Correction`, or a mismatched `operator_waste` / `operator_receipt`
label, move on-hand under today's projection, raise Activity, and forge
Activity / history write-path provenance.

## Change

- Domain: reject `unsupported_correction_source` unless exact trim
  `operator_correction`.
- Additive BEFORE INSERT trigger with the same exact message; does not
  redeclare `record_inventory_event`.
- Transport maps hosted `22023` “correction source” ahead of the generic
  evidence matcher so the device outbox settles terminally.
- Existing ledger correction fixtures stamp `operator_correction`.
- Dedicated pgTAP plan=8 (assert call sites counted from source).

## Alone-OK

Orthogonal to:

- orphan supersede (#394) and exact-reverse (#395)
- product correction writers (#345/#350)
- operator_* / event_type match (#1264)
- other event-type source allowlists (#1259–#1269)
- purchase-line stack (#1238/#1250–#1258)

Does not touch UI, i18n, or `miseValidation`.

## Verification

- `npm run typecheck`
- focused `tests/unsupportedInventoryCorrectionSource.test.ts` + ledger suite
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run supabase:test` not run in this environment (no Docker)

## Classification

Controlled pilot integrity hardening. Does not change App Store / founder blockers.
