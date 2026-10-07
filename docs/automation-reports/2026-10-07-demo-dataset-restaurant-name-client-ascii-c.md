# MISE-005JP: pin demoDataset restaurant-name identity to ASCII C

## Summary

`services/demo/demoDataset.ts` still compared restaurant names with
Unicode-aware `trim` / `toLowerCase` for demo-mode labeling, default dataset
selection, and reference-state repair. Sibling client tips already pin demo
repository inventory/menu keys (#683), operatingPlan prep-window tokens (#684),
and other identity folds to ASCII C, and hosted helpers fold under SQL
`lower(... collate "C")`. Under Unicode case folding, a Kelvin sign (`K`)
becomes `k`, which can invent a demo restaurant-name match the ASCII C path
would refuse.

This tip replaces that identity fold with ASCII C case fold and ASCII-only
whitespace trim, and routes `repairDemoState` through the shared predicate so
reference-dataset detection cannot drift.

## Scope

- Client/demo change in `demoDataset.ts` and `replaceableDemoData.ts`
- Focused static + behavioral tests
- Does **not** tip `normalizeSetupList` / `normalizeLookup` (conflict risk with
  open #670 receive-discrepancy work)
- Does **not** re-tip demoRepository (#683), operatingPlan (#684), outreach
  (#420), supplierSendContent (#425), or demoSupplierIdentity (#410)
- Does **not** rewrite SQL uniqueness / CHECK migrations

## Verification

- `npm run typecheck`
- focused `tests/demoDatasetRestaurantNameClientAsciiC.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Product note

Controlled pilot-ready codebase. This closes a demo restaurant-name identity
parity gap; it does not unblock live POS credentials or App Store submission.
