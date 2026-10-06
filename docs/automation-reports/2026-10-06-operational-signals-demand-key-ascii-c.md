# MISE-005JH: pin operationalSignals demand-spike identity to saleDemandKey + ASCII C

## Summary

`services/domain/operationalSignals.ts` built demand baselines with
`saleDemandKey` (menu-item id for verified provider sales; name fold for
manual) but looked up demand-rising spikes with `normalizeKey(sale.item_name)`.
That missed every provider-mapped baseline and used Unicode-aware
`trim` / `toLowerCase` / `\s+` for insight slugs while sibling client tips
already pin provider-sale identity (#673) and hosted helpers fold under SQL
`lower(... collate "C")`.

This tip routes spike and prep insight identity through `saleDemandKey`, and
slugs those keys with ASCII C case fold plus ASCII-only whitespace collapse so
Kelvin-sign folds cannot invent demand-spike ids the ASCII C path would refuse.

## Scope

- Client-only change in `operationalSignals.ts`
- Focused static + behavioral tests
- Does **not** re-tip providerSaleIdentity (#673), miseDomain (#675),
  setupDrafts (#676), inventoryUnits (#669), or barcode (#674)
- Does **not** rewrite SQL demand / POS identity CHECKs

## Verification

- `npm run typecheck`
- focused `tests/operationalSignalsDemandKeyAsciiC.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Product note

Controlled pilot-ready codebase. This restores truthful demand-rising insights
for verified POS sales and closes a client identity parity gap for spike/prep
slugs; it does not unblock live POS credentials or App Store submission.
