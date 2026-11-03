# MISE-005WR — Inventory detail supplier_name ASCII C

Date: 2026-11-03  
Branch: `cursor/mise-inventory-detail-supplier-name-ascii-c`

## Defect

Inventory detail always composed the Screen subtitle from raw
`item.supplier_name` whenever an outlook item existed:

```ts
subtitle={item ? `${item.supplier_name} · ${item.category}` : t("inventory.detail.subtitle")}
```

Empty string rendered a blank-looking supplier before the category separator
(`" · Produce"`). A Unicode-only-space supplier name (`"\u2003"`) is truthy and
rendered the same blank-looking identity (`"  · Produce"`). Unicode `.trim()`
on a padded supplier name would invent a clean display label
(`"\u2003Sysco\u2003".trim() === "Sysco"`).

## Fix

- `services/domain/presentationInventoryDetailSupplierNameIdentity.ts` — ASCII C
  single-line end trim; preserve NBSP; full C0/DEL reject; soft-null
- `app/inventory/[id].tsx` — subtitle supplier through
  `normalizeInventoryDetailSupplierName` with localized
  `inventory.detail.supplierName.none` fallback
- `i18n/catalog.ts` — EN / ES / zh-Hans none copy
- Focused inventing + bypass proofs in
  `tests/inventoryDetailSupplierNameAsciiC.test.ts`

## Alone-OK

Leaves Orders review recommendation.supplier_name (#1051), SupplierDraftCard
order.supplier_name (#1050), Orders detail title (#1016), miseDomain
draft-order (#1034), daily-report `supplier.supplierName`, Settings suppliers
`entry.supplierName`, Inventory detail title `item.item_name`, and Inventory
detail `item.category` alone.
