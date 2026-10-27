# MISE-005RR setup supplierNames ASCII C

Date: 2026-10-27  
Branch: `cursor/mise-setup-supplier-names-ascii-c`

## Problem

`app/(auth)/setup.tsx` fed supplier `name` into `supplier.name.trim()` for the
durable `supplierNames` list passed to `continueWithDemo` (demo supplier
catalog + `operational_profile.primarySuppliers`) and hosted
`updateRestaurantProfile` `primarySuppliers`. Unicode trim invents a clean
supplier name (`'\u2003Fresh\u2003'.trim() === 'Fresh'`). Unicode-only space
also invents the filter(Boolean) skip branch via `'\u2003'.trim() === ''`.

Open #680 / MISE-005JK pins application setup supplier-name keys / email.
Open #696 / MISE-005KA pins setup-screen duplicate / email identity.
Open #852 / MISE-005PR pins operational-profile array-entry normalize after
profile update. None own this screen `supplierNames` durable list path. Tip
them separately.

## Change

- New `services/domain/setupSupplierNamesIdentity.ts` (MISE-005RR)
- Soft empty / Unicode-only space → `empty` (filter skip; no durable entry)
- ASCII whitespace still trims clean before durable supplierNames
- Unicode-padded / control → `invalid` (`supplierNameInvalid`; no invent)
- Wire setup supplier validate inventing gate + `collectSetupSupplierNames`
  through `prepareSetupSupplierNameText`
- Leave duplicate/email bare `supplier.name.trim()` to open #696 / MISE-005KA
- Leave chip label / supplier_count / inventory supplier emptiness bare trim
- Leave inventoryItemNames Unicode trim to open #903 / MISE-005RQ
- Leave application `supplier.name.trim()` to open #680 / MISE-005JK

## Landing notes

Alone-OK with #903 / #902 / #901 / #900 / #899 / #898 / #897 / #896 / #895 /
#894 / #862 / #861 / #852 / #696 / #680. Keep
`setupSupplierNamesIdentity.ts` separate from
`setupScreenSupplierIdentity.ts` (#696), application setup helpers (#680),
`operationalProfileArrayEntryIdentity.ts` (#852), and
`setupInventoryItemNameIdentity.ts` (#903). When landing with #696, drop this
tip's assertion that setup still uses bare
`supplier.name.trim().replace(/\s+/g, " ")` / `email.trim()` /
`toLocaleLowerCase("en-US")` once #696 owns those validate paths. When landing
with #903, drop this tip's assertion that setup still uses bare
`item.name.trim()` for `inventoryItemNames` once #903 owns that list.

## Verification

- focused AsciiC 4/4
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles` on main; tip +4 vs main ~683)
- Docker pgTAP unavailable in this environment
