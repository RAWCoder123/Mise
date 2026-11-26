# 2026-11-26 — Inventory correction reason evidence

## Gap

`record_inventory_event` accepted `correction` rows with missing or free-form
`reason_code`. A manager JWT could rewrite on-hand under correction semantics
without a comparable taxonomy (`manual_fix`, case variants, blank), leaving
Activity / correction analysis without stable provenance.

Product writers already stamp bounded codes:

- #345 waste correction → `waste_correction`
- #350 receipt correction → `receipt_correction`

## Change

- Domain allowlist `{waste_correction, receipt_correction}` with rejection
  reasons `correction_requires_reason` / `invalid_correction_reason`.
- Additive BEFORE INSERT trigger on `public.inventory_events` plus a NOT VALID
  CHECK that skips legacy rows.
- Transport maps hosted `22023` messages ahead of the generic evidence matcher
  so the device outbox settles terminally.
- Dedicated pgTAP plan=8 covers bare/bad/case rejects, allowlisted accept +
  persistence, non-correction unconstrained, and direct-insert reject.

## Alone-OK

Orthogonal to correction-source #1272, correction-note #1273, supersede #394,
exact-reverse #395, waste/stockout reason tips #1270/#1271, and purchase-line
#1238/#1250–#1258. Does not edit UI, i18n, or `miseValidation`.

## Verification

- `npm run typecheck`
- focused correction-reason + ledger suite
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
