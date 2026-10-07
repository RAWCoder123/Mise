# MISE-005JL: pin supplier-recipient email client normalize to ASCII C

Date: 2026-10-07  
Base: `origin/main` @ `78da7376` (MISE-005A)  
Complements: open MISE-005IU (`#663`) supplier_recipients.email shape CHECK;
open MISE-005K (`#419`) supplier_recipients cntrl CHECK

## Problem

`requireSupplierRecipientInput` used Unicode-aware `trim()` / `toLowerCase()`
and a `\s`-based mailbox shape on the owner/admin/manager supplier-email save
path. Hosted CHECKs (MISE-005IU / MISE-005K) pin `[[:space:]]` / `[[:cntrl:]]`
under `COLLATE "C"`. Locale drift lets the client invent a Kelvin-folded
mailbox (`K` → `k`) the hosted path would not treat as identical, or reject
NBSP the C-locale space class would accept.

`requireNullableSupplierSendEmail` had the same Unicode case check and `\s`
shape for supplier-send preview From/To validation.

## Change

- Client-only pin in `services/miseValidation.ts` (MISE-005JL)
- ASCII A–Z case fold + ASCII whitespace trim for recipient input
- Mailbox shape uses ASCII whitespace class, not `\s`
- Preview email gate uses the same ASCII case + mailbox helpers
- Focused static + behavioral tests in
  `tests/supplierRecipientEmailClientAsciiC.test.ts`

Does not add a migration (SQL pins remain `#419` / `#663`). Does not rewrite
`upsert_supplier_recipient`, setup optional email (`#680`), or outreach email
(`#420`).

## Verification

- `npm run typecheck`
- focused `tests/supplierRecipientEmailClientAsciiC.test.ts`
- `tests/supplierRecipients.test.ts`
- `npm test` (when practical)
- `npm run security:static` / `npm run security:backend`
