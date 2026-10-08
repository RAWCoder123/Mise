# MISE-005KW: pin requireSupplierAuthorityId to ASCII C

Date: 2026-10-08  
Branch: `cursor/mise-supplier-authority-id-ascii-c`  
Base: `origin/main` @ `78da737`

## Problem

`services/miseValidation.requireSupplierAuthorityId` used Unicode `String.prototype.trim()` before a case-insensitive UUID shape check. NBSP / em-space padding around a valid UUID therefore canonicalized to the unpadded identity, inventing a supplier, restaurant, or inventory-item authority key the caller did not send.

## Change

- Add `services/domain/supplierAuthorityIdentity.ts` with ASCII-only end trim, ASCII A–Z fold, and fail-closed canonicalize/require helpers.
- Route `requireSupplierAuthorityId` through `requireCanonicalSupplierAuthorityUuid`, preserving `Missing ${label} identity.` and the historical UUID version range `[1-5]`.
- Canonical returns are lowercase hex under ASCII C.
- Leave hosted repository UUID (#725), Edge/outreach UUID (#719/#720), and other tipped identity fields untouched.

## Tests

- `tests/supplierAuthorityIdAsciiC.test.ts` — wiring, case fold, Kelvin fail-closed, NBSP/em-space inventing proofs.

## Out of scope

- `requireSupplierRecipientInput` restaurant_id Unicode trim (separate tip if still open).
- Hosted `requireHostedUuid` / Edge `requireUuid` (already tipped).
