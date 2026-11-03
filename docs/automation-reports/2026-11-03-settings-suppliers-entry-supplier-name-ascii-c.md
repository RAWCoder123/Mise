# MISE-005WT — Settings suppliers entry.supplierName ASCII C

Date: 2026-11-03  
Branch: `cursor/mise-settings-suppliers-entry-supplier-name-ascii-c`

## Defect

Settings → Suppliers always rendered raw `entry.supplierName` into the
directory supplierName Text and into notice / accessibility interpolations:

```ts
<Text style={styles.supplierName} numberOfLines={2}>{entry.supplierName}</Text>
```

Empty string rendered a blank-looking supplier identity. A Unicode-only-space
supplier name (`"\u2003"`) is truthy and rendered the same blank-looking
identity. Unicode `.trim()` on a padded supplier name would invent a clean
display label (`"\u2003Sysco\u2003".trim() === "Sysco"`).

## Fix

- `services/domain/presentationSettingsSuppliersEntrySupplierNameIdentity.ts` —
  ASCII C single-line end trim; preserve NBSP; full C0/DEL reject; soft-null
- `app/settings/suppliers.tsx` — directory chrome, a11y, and notice supplier
  tokens through `normalizeSettingsSuppliersEntrySupplierName` with localized
  `settings.suppliers.supplierName.none` fallback
- `i18n/catalog.ts` — EN / ES / zh-Hans none copy
- Focused inventing + bypass proofs in
  `tests/settingsSuppliersEntrySupplierNameAsciiC.test.ts`

## Alone-OK

Leaves suppliers-settings rename prep (#691), supplier display-name validation /
directory prep (#692), draft-email (#690), read-only email (#1032), Inventory
detail item.supplier_name (#1052), Orders review recommendation.supplier_name
(#1051), SupplierDraftCard order.supplier_name (#1050), Orders detail title
(#1016), miseDomain draft-order (#1034), and daily-report
`supplier.supplierName` (#1053) alone. Does not rewrite draft seeding, rename
unchanged compare, or raw `entry.email` display.

## Verification

- focused tip tests
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`
