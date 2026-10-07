# MISE-005JV: pin suppliers-settings display-name identity to ASCII C

Date: 2026-10-07

## Problem

`app/settings/suppliers.tsx` prepared rename drafts and decided “name unchanged”
with Unicode `trim()` plus `\s+` collapse. That can invent equality for
non-C whitespace (for example em-space) that `private.normalize_supplier_display_name`
under COLLATE `"C"` (MISE-005B / #410) would leave alone, and can disagree with
the hosted display-name contract operators rename against.

## Change

- New `services/domain/supplierSettingsNameIdentity.ts` (MISE-005JV)
- Explicit NBSP → space, ASCII C whitespace collapse, ASCII space trim
- Preserve accents and case (discovery lowercasing stays on #410)
- Wire Settings suppliers rename prep + unchanged-draft compare through those helpers
- Focused static + behavioral tests; leave draft-email path to #690

## Out of scope

- `#690` suppliers-settings draft-email identity
- `#410` SQL / `supplierNameNormalization.ts` durable normalize (already tipped)
- `miseValidation.requireSupplierDisplayName` Unicode prep (separate client tip)

## Verification

- `npm run typecheck`
- focused `tests/supplierSettingsNameIdentityAsciiC.test.ts`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
