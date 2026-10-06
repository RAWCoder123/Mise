# MISE-005JK — setup supplier-name + optional email ASCII C

Date: 2026-10-06

## Problem

`services/application/setup.ts` used Unicode-aware folding for two setup
identity paths:

- supplier-name duplicate detection via `toLocaleLowerCase("en-US")`
- optional supplier email via `trim().toLowerCase()` and a `\s`-based mailbox
  shape

Unicode case fold maps Kelvin sign `K` → `k`, so a lookalike supplier name or
mailbox can invent a duplicate/match the hosted COLLATE C path would not treat
as identical. Unicode `\s` also treats NBSP as whitespace, unlike C-locale
`[[:space:]]`.

## Change

Client-only pin in `services/application/setup.ts`:

- `normalizeSetupSupplierNameKey` / `setupSupplierNameKeysMatch` — ASCII A–Z
  case fold + ASCII whitespace trim
- `normalizeSetupOptionalEmail` — same fold/trim, explicit ASCII control
  rejection, ASCII mailbox shape (no Unicode `\s`)
- Validation and persistence routes use the helpers

Does not tip setup inventory ↔ recipe name linking (#679 / MISE-005JJ). Does
not add a migration (`normalize_supplier_name` remains #410; supplier recipient
email shape remains #422/#663).

## Verification

- `npm run typecheck` passed
- focused `tests/setupSupplierNameEmailClientAsciiC.test.ts` 4/4 passed
- `npm test` 687 total / 680 pass / 0 fail / 7 cancelled (inherited recalculationCycles timer flake)
- `npm run security:static` + `npm run security:backend` passed
