# MISE-005JQ: pin replaceableDemoData setup-list and lookup normalize to ASCII C

## Summary

`services/demo/replaceableDemoData.ts` still normalized custom demo setup-list
names and ingredient/inventory fuzzy lookup keys with Unicode-aware `trim` /
`toLowerCase`. Sibling client tips already pin demoDataset restaurant names
(#685), demoRepository inventory/menu keys (#683), setup inventory names
(#679), and other identity folds to ASCII C, and hosted helpers fold under SQL
`lower(... collate "C")`. Under Unicode case folding, a Kelvin sign (`K`)
becomes `k`, which can invent a setup-list dedupe or recipe-lookup identity key
the ASCII C path would refuse.

This tip replaces those identity folds with ASCII C case fold and ASCII-only
whitespace trim, while preserving the existing ASCII pack/unit token collapse
on lookup keys.

## Scope

- Client/demo change in `replaceableDemoData.ts` (`normalizeSetupList` /
  `normalizeLookup` / `findInventoryItemByName`)
- Focused static + behavioral tests
- Does **not** tip `repairDemoState` restaurant-name matching (owned by open
  #685)
- Does **not** re-tip demoDataset (#685), demoRepository (#683), operatingPlan
  (#684), setup.ts (#679/#680), outreach (#420), supplierSendContent (#425), or
  demoSupplierIdentity (#410)
- Does **not** rewrite SQL uniqueness / CHECK migrations
- Low conflict risk with open #670 (receive discrepancy only adds an optional
  `discrepancy_reason` field on `DemoState`; rebase if both land)

## Verification

- `npm run typecheck`
- focused `tests/replaceableDemoSetupLookupClientAsciiC.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Product note

Controlled pilot-ready codebase. This closes a demo setup/lookup identity
parity gap; it does not unblock live POS credentials or App Store submission.
