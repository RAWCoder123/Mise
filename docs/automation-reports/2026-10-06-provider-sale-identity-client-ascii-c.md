# MISE-005JC: pin providerSaleIdentity client normalize to ASCII C

## Summary

`services/domain/providerSaleIdentity.ts` still normalized provider source,
location, and fallback item-name tokens with Unicode-aware `trim` /
`toLowerCase` / `\s+`. Hosted POS and recipe-matching paths fold with SQL
`lower(...)` (and sibling tips pin those helpers under `COLLATE "C"`). Under
Unicode case folding, a Kelvin sign (`K`) becomes `k`, which can invent a
`square` source token or an item-name match the ASCII C path would refuse.

This tip replaces the client normalizer with ASCII C case fold and ASCII-only
whitespace collapse so demo/client provider-sale identity stays aligned with
the server locale-stable contract.

## Scope

- Client-only change in `providerSaleIdentity.ts`
- Focused static + behavioral tests
- Does **not** rewrite SQL `source_pos` / provider-id CHECKs or prepare_square
  preflights (#417/#429/#657/#465/#467)
- Does **not** re-tip inventoryUnits (#669), purchase-line unit helpers (#668),
  or operationalMapping.normalizeUnit (#664)

## Verification

- `npm run typecheck`
- focused `tests/providerSaleIdentityClientAsciiC.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Product note

Controlled pilot-ready codebase. This closes a client/server identity parity
gap for POS→recipe matching; it does not unblock live POS credentials or App
Store submission.
