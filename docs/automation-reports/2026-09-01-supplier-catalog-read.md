# 2026-11-05 — Supplier catalog READ (main rebase)

Tip: `cursor/mise-supplier-catalog-read-main-rebase` — MERGEABLE onto `origin/main`.
Supersedes stale #334 (`cursor/mise-supplier-catalog-read`), which was based on
`20b28e50` and behind MISE-004C / MISE-005A.

## Summary

Expose existing SELECT-backed `supplier_items` catalog evidence (free-text
`pack_size`, `preferred`, and `supplier_sku`) on Settings → Suppliers as a
read-only browse surface. Demo seeds now carry realistic SKUs and pack labels
so the path is demonstrable without inventing hosted catalog facts.

## Changes

- Cherry-picked #334 commit `fc0be049` onto current main (`78da7376`);
  `services/demo/replaceableDemoData.ts` auto-merged cleanly.
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
- No ASCII-C inventing tips for catalog line fields on this tip (leave for
  inventing/bypass proof distinct from tipped Settings suppliers name paths).

## Why this tip

Operators can manage recipients but cannot browse existing SELECT-backed pack
labels, preferred flags, and SKUs on Settings → Suppliers. Session-only (no
migration); alone-OK beside receive stacks #1100–#1102 and #1103/#1104.

## Land notes

Do not merge stale #334. Prefer this tip.

## Verification

- `npm run typecheck`
- `node --import tsx --test tests/supplierCatalog.test.ts tests/supplierCatalogUi.test.ts` (5/5)
- `npm test` (688 total / 681 pass / 0 fail / 7 cancelled pre-existing withTimeout)
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- No migration; Docker pgTAP not required

## Classification

Controlled pilot-ready code improvement. Not App Store submission-ready.
