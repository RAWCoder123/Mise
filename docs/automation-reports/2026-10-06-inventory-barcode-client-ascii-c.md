# MISE-005JE: pin inventory barcode client normalize to ASCII C

Date: 2026-10-06  
Base: `origin/main` @ `78da7376` (MISE-005A)  
Follows: MISE-005JD team-member email client ASCII C on the same branch

## Problem

`normalizeInventoryBarcodeToken` used Unicode-aware `trim()` / `toLowerCase()`
before stripping non-alphanumerics. Locale drift lets Kelvin sign `K` fold to
`k` and invent a scan/name token match that COLLATE C identity helpers would
not produce.

## Change

- Client-only pin in `services/domain/inventoryBarcodeMatch.ts`
- ASCII A–Z case fold only (`asciiCLower`)
- ASCII whitespace trim (no Unicode `trim`)
- Focused static + behavioral tests in
  `tests/inventoryBarcodeMatchClientAsciiC.test.ts`

Does not change ranking thresholds, scan UI, or supplier SKU capture flows.

## Verification

- `npm run typecheck`
- focused barcode ASCII C + existing barcode tests
- `npm test` (when practical)
- `npm run security:static` / `npm run security:backend`
