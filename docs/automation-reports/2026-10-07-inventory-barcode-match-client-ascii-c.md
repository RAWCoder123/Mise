# MISE-005JR: pin inventoryBarcodeMatch normalize to ASCII C

## Summary

`services/domain/inventoryBarcodeMatch.ts` still normalized Scan Item barcode /
inventory match tokens with Unicode-aware `trim` / `toLowerCase`. Sibling
client tips already pin inventory units (#669), purchase-line units (#668),
setup inventory names (#679), and other identity folds to ASCII C, and hosted
helpers fold under SQL `lower(... collate "C")`. Under Unicode case folding, a
Kelvin sign (`K`) becomes `k`, which can invent a barcode match token the
ASCII C path would refuse.

This tip replaces that identity fold with ASCII C case fold and ASCII-only
whitespace trim, while preserving the existing ASCII alnum collapse used for
barcode / name / supplier matching.

## Scope

- Client domain change in `inventoryBarcodeMatch.ts`
  (`normalizeInventoryBarcodeToken`)
- Focused static + behavioral tests
- Does **not** re-tip inventoryUnits (#669), purchase-line units (#668),
  replaceableDemo setup/lookup (#686), demoDataset restaurant-name (#685),
  operatingPlan (#684), demoRepository (#683), outreach (#420),
  supplierSendContent (#425), or demoSupplierIdentity (#410)
- Does **not** rewrite SQL uniqueness / CHECK migrations
- Does **not** expand Scan Item SKU capture (owned by open #218)

## Verification

- `npm run typecheck`
- focused `tests/inventoryBarcodeMatchClientAsciiC.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Product note

Controlled pilot-ready codebase. This closes a Scan Item barcode-match
identity parity gap; it does not unblock live POS credentials or App Store
submission.
