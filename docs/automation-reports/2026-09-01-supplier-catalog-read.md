# 2026-09-01 — Supplier catalog READ

## Summary

Expose existing SELECT-backed `supplier_items` catalog evidence (free-text
`pack_size`, `preferred`, and `supplier_sku`) on Settings → Suppliers as a
read-only browse surface. Demo seeds now carry realistic SKUs and pack labels
so the path is demonstrable without inventing hosted catalog facts.

## Changes

- Domain: `buildSupplierCatalogBrowse` groups tenant catalog lines by durable
  supplier ID and preserves null pack/SKU evidence.
- Application: `fetchSupplierCatalog` reuses `fetchRestaurantOpsProfile`
  SELECT path with restaurant-scope validation.
- Presentation: query filter over item name, SKU, pack label, and supplier.
- UI: Settings Suppliers catalog section with search; EN / ES / zh-Hans copy.
- Demo: seed SKUs, pack labels for common units, and category-based preferred
  flags (protein/produce).
- More hub subtitle advertises catalog evidence.

## Non-goals

- No catalog writes, pack_quantity verification (#291), or barcode SKU capture
  (#218).
- No MOQ / lead_time / expiration invention.

## Verification

- `npm run typecheck`
- `node --import tsx --test tests/supplierCatalog.test.ts tests/supplierCatalogUi.test.ts` (5/5)
- `npm test` (637 pass / 0 fail / 7 cancelled pre-existing)
- `npm run security:static`
- `npm run design:static`

## Classification

Controlled pilot-ready code improvement. Not App Store submission-ready.
