# MISE-005KX: pin supplier-recipient restaurant workspace identity to ASCII C

Date: 2026-10-08

## Gap

`requireSupplierRecipientInput` Unicode-trimmed `restaurant_id` before length and
control checks. NBSP / em-space padding around a valid workspace token (including
demo IDs like `restaurant_a`) invented a canonical restaurant workspace identity.

Email normalization remains owned by open tip #681. Supplier UUID identity remains
owned by open tip #726.

## Change

- Add `services/domain/supplierRecipientRestaurantIdentity.ts`
  (`asciiTrimSupplierRecipientRestaurantToken`,
  `canonicalizeSupplierRecipientRestaurantId`,
  `requireCanonicalSupplierRecipientRestaurantId`)
- Route `requireSupplierRecipientInput` restaurant_id through that helper
- Preserve `Missing restaurant workspace.` and non-UUID workspace tokens
- Add inventing proofs in `tests/supplierRecipientRestaurantAsciiC.test.ts`

## Verification

- Focused Node tests for MISE-005KX
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
