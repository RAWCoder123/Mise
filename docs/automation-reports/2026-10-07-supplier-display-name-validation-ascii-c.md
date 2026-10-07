# MISE-005JW: pin supplier display-name validation to ASCII C

Date: 2026-10-07

## Problem

`requireSupplierDisplayName` prepared supplier display names with Unicode
`trim()` plus `\s+` collapse. That can invent equality for non-C whitespace
(for example em-space) that `private.normalize_supplier_display_name` under
COLLATE `"C"` (MISE-005B / #410) would leave alone, and can disagree with the
Settings UI prep in MISE-005JV (#691). The supplier-recipient directory used
the same Unicode prep when presenting durable supplier names.

## Change

- New `services/domain/supplierDisplayNameIdentity.ts` (MISE-005JW)
- Explicit NBSP → space, ASCII C whitespace collapse, ASCII space trim
- Preserve accents and case (discovery lowercasing stays on #410)
- Wire `requireSupplierDisplayName` and supplier-recipient directory presentation
  through `canonicalSupplierDisplayName`
- Focused static + behavioral tests

## Out of scope

- `#691` suppliers-settings display-name identity (already tipped)
- `#410` SQL / `supplierNameNormalization.ts` durable normalize (already tipped)
- `#681` / `#690` supplier-recipient email tips (already tipped)
- Demo `normalizeDemoSupplierDisplayName` (tipped via #410 — do not re-tip)

## Verification

- `npm run typecheck`
- focused `tests/supplierDisplayNameIdentityAsciiC.test.ts`
- `tests/supplierRecipients.test.ts`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
