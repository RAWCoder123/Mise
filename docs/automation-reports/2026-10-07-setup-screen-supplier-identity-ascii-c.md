# MISE-005KA: pin auth setup-screen supplier identity to ASCII C

Date: 2026-10-07

## Problem

`app/(auth)/setup.tsx` decided supplier-name duplicates with Unicode
`trim()` / `\s+` collapse plus `toLocaleLowerCase("en-US")`, and validated
optional supplier emails with a Unicode `\s`-based mailbox shape. That can:

- invent Kelvin-folded duplicate matches (`K` → `k`) the application-layer
  setup tip (MISE-005JK / #680) and hosted COLLATE "C" supplier identity
  would refuse;
- treat NBSP / em-space as ordinary collapsing whitespace the C-locale
  display prep would leave alone;
- accept or reject mailboxes differently from ASCII C recipient gates.

Open MISE-005JK / #680 tips `services/application/setup.ts`. This tip covers
the auth setup screen local validation only.

## Change

- New `services/domain/setupScreenSupplierIdentity.ts` (MISE-005KA)
  - NBSP fold + ASCII C whitespace collapse for display prep
  - ASCII A–Z case fold for duplicate-name keys
  - ASCII C mailbox shape / trim / fold for optional supplier email
- Wire `validateSetupDrafts` in `app/(auth)/setup.tsx` through those helpers
- Focused static + behavioral tests; automation report

## Out of scope

- `#680` / `#679` application `setup.ts` (already tipped on open branches)
- `#690` / `#691` Settings suppliers UI
- `#410` SQL / `supplierNameNormalization.ts` durable normalize
- Recipe / inventory / restaurant-name paths on the setup screen

## Verification

- `npm run typecheck`
- focused `tests/setupScreenSupplierIdentityAsciiC.test.ts`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
