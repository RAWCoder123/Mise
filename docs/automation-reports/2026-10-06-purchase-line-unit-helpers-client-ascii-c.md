# MISE-005IZ — purchase-line client unit helpers ASCII C parity

Date: 2026-10-06  
Branch: `cursor/mise-purchase-line-unit-helpers-client-ascii-c`  
Base: `origin/main` @ `78da7376`

## Gap

`services/domain/purchaseLines.ts` still folded unit tokens with Unicode-aware
`toLowerCase()` in `purchaseLineUnitDimension` and the pack-size trailing-unit
extract. MISE-005IX (#666) pins the SQL IMMUTABLE helpers
`private.purchase_line_unit_dimension` and `private.purchase_line_pack_unit` to
`lower(... collate "C")`. Client and server could disagree on the same unit
bytes after dump/restore locale drift and flip
`pack_unit_dimension_conflict` / confidence.

## Change

- Fold only ASCII A-Z (same pattern as `foldPurchaseLineDescription`).
- Trim ASCII spaces after fold to mirror `btrim(lower(... collate "C"))`.
- Pack extract uses `([a-z]+)$` after ASCII C fold (no Unicode flag).
- Export `purchaseLinePackUnit` for parity tests; consistency path unchanged.
- Focused source + behavioral tests (4/4).

## Out of scope

- SQL unit helpers themselves (#666 / MISE-005IX)
- `purchase_units_compatible` (#665), conversion helpers (#664)
- Ingest document-reference cntrl (#667)
- Fold/normalize purchase-line helpers (MISE-005A)

## Classification

Controlled pilot-ready codebase tip. Not App Store submission-ready.
