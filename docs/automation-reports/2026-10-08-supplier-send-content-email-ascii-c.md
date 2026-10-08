# MISE-005KM: pin demo supplier-send mailbox identity to ASCII C

Date: 2026-10-08  
Base: `origin/main` @ `78da7376` (MISE-005A)  
Complements: open MISE-005JL (`#681`) supplier-recipient / preview email client
normalize; open MISE-005IU (`#663`) supplier_recipients.email shape CHECK

## Problem

Demo `buildCanonicalSupplierSendContent` normalized From/To addresses with
Unicode-aware `trim()` / `toLowerCase()` and a `\s`-based mailbox shape before
serializing the reviewed send snapshot. Hosted supplier-send and recipient paths
pin case and whitespace under `COLLATE "C"`. Locale drift lets the demo path
invent a Kelvin-folded mailbox (`K` → `k`) that changes the content fingerprint
the operator reviews, or reject NBSP the C-locale space class would still treat
as part of the mailbox identity.

Sibling tips already pin the save-path and preview validation helpers
(`#681`) and the hosted email shape CHECK (`#663`). The demo fingerprint builder
still used the Unicode fold.

## Change

- Client-only pin in `services/domain/supplierSendContent.ts` (MISE-005KM)
- Export `normalizeSupplierSendEmail` with ASCII A–Z case fold, ASCII whitespace
  trim, and ASCII mailbox shape
- Route connected sender and matching recipient addresses through that helper
- Focused static + behavioral tests in
  `tests/supplierSendContentEmailAsciiC.test.ts`

Does not add a migration (SQL pins remain `#663` / related recipient CHECKs).
Does not rewrite `miseValidation` (`#681`), outreach email (`#420`), beta
provisioning email (`#707`), or Gmail header helpers (`#693` / `#694` / `#705`).

## Verification

- `npm run typecheck`
- focused `tests/supplierSendContentEmailAsciiC.test.ts`
- `tests/supplierSendContent.test.ts` / `tests/demoSupplierSendIntegrity.test.ts`
  when practical
- `npm test` (when practical)
- `npm run security:static` / `npm run security:backend`
