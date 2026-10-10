# MISE-005MM: setup referenceId ASCII C

Date: 2026-10-10  
Branch: `cursor/mise-product-inspection-e59c`  
Baseline: `origin/main` at `78da73769b8afee641d9754f11665589df363814`

## Problem

`services/application/setup.ts` `requireSetupReferenceId` used Unicode
`.trim()` on supplier draft client references (`supplier.id`, inventory
`supplierId`). NBSP or em-space padding around a valid reference would invent
the normalized identity and pass the control/length gate.

## Change

- Added `services/domain/setupReferenceIdentity.ts` with ASCII-only end trim,
  canonicalize, and fail-closed require helpers.
- Routed `requireSetupReferenceId` through
  `requireCanonicalSetupReferenceId` while preserving
  `Setup ${label} reference is invalid.`
- Left `saveRestaurantSetup` `restaurantId.trim()` on Unicode trim for open
  tip #742 / MISE-005LL.
- Left attachment `client_reference_id: attachment.id` (no trim) alone.
- Max length remains 128.

## Verification

- Focused `tests/setupReferenceAsciiC.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`

## Merge note

When landing with #742, keep restaurant and referenceId branches in
`setup.ts`. Drop any #742 assertion that `requireSetupReferenceId` still
Unicode-trims.
