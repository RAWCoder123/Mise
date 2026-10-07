# MISE-005JU: pin suppliers-settings draft-email identity to ASCII C

Branch: `cursor/mise-suppliers-settings-email-ascii-c`  
Base: `origin/main` @ `78da737` (MISE-005A)

## Problem

`app/settings/suppliers.tsx` decided draft-email “unchanged” with Unicode
`trim()` / `toLowerCase()`, and validated save candidates with Unicode trim
plus a `\s`-based mailbox shape. That can:

- invent Kelvin-folded equality (`K` → `k`) and disable Save when the draft is
  not the same mailbox the hosted COLLATE C recipient path would treat as
  identical;
- treat NBSP as space / shape-breaking whitespace the C-locale gates would not.

Open MISE-005O / #423 already tips Edge `gmail.ts` `normalizeEmail`. Open
MISE-005JL / #681 tips `requireSupplierRecipientInput`. This tip covers the
settings UI draft compare + local gate only.

## Change

- New `services/domain/supplierSettingsEmailIdentity.ts` (MISE-005JU)
  - ASCII A–Z case fold + ASCII whitespace trim
  - ASCII mailbox shape (no Unicode `\s`)
  - `supplierSettingsEmailsMatch` / `normalizeSupplierSettingsRecipientEmail` /
    `isValidSupplierSettingsRecipientEmail`
- Wire `app/settings/suppliers.tsx` save path + Save disabled state through those
  helpers
- Focused static + behavioral tests

## Scope boundaries

- Does **not** rewrite `services/miseValidation.ts` `requireSupplierRecipientInput`
  (#681)
- Does **not** rewrite Edge `_shared/gmail.ts` (#423)
- Does **not** tip supplier display-name `canonicalSupplierName` (separate)
- Does **not** add a migration

## Verification

- `npm run typecheck`
- focused `tests/supplierSettingsEmailIdentityAsciiC.test.ts`
- `npm test`
- `npm run security:static` + `npm run security:backend`
