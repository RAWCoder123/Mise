# MISE-005JG: pin setupDrafts header/fingerprint normalize to ASCII C

## Summary

`services/domain/setupDrafts.ts` still normalized CSV header aliases and POS
import fingerprint tokens with Unicode-aware `trim` / `toLowerCase`. Sibling
client tips already pin demand keys (#675), provider-sale identity (#673), and
unit helpers (#669/#668) to ASCII C. Under Unicode case folding, a Kelvin sign
(`K`) becomes `k`, which can invent a header alias (`KALE_DATE` → `sale_date`)
or collapse distinct POS import fingerprints.

This tip replaces header and fingerprint token normalize with ASCII C case fold
and ASCII-only whitespace collapse.

## Scope

- Client-only change in `setupDrafts.ts`
- Focused static + behavioral tests
- Does **not** re-tip miseDomain (#675), providerSaleIdentity (#673),
  inventoryUnits (#669), or barcode (#674)

## Verification

- `npm run typecheck`
- focused `tests/setupDraftsClientAsciiC.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Product note

Controlled pilot-ready codebase. Closes a setup-import identity parity gap; does
not unblock live POS credentials or App Store submission.
