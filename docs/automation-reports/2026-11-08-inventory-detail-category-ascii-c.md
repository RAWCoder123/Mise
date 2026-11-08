# MISE-005AAD — Inventory detail category ASCII C

Date: 2026-11-08  
Branch: `cursor/mise-inventory-detail-category-ascii-c`

## Defect

Inventory detail always interpolated raw `item.category` into the Screen
subtitle whenever an item outlook existed:

```ts
subtitle={item ? `${item.supplier_name} · ${item.category}` : t("inventory.detail.subtitle")}
```

Empty string rendered a blank-looking category identity after the supplier
separator (`"Sysco · "`). A Unicode-only-space category (`"\u2003"`) is truthy
and rendered the same blank-looking identity (`"Sysco ·  "`). Unicode `.trim()`
on a padded category would invent a clean display label
(`"\u2003Produce\u2003".trim() === "Produce"`).

Open tip #1052 (Inventory detail supplier_name) explicitly left this subtitle
category path alone.

## Fix

- `services/domain/presentationInventoryDetailCategoryIdentity.ts` —
  ASCII C single-line end trim; preserve NBSP; full C0/DEL reject; soft-null
- `app/inventory/[id].tsx` — subtitle category through
  `normalizeInventoryDetailCategory` with localized
  `inventory.detail.category.none` fallback
- `i18n/catalog.ts` — EN / ES / zh-Hans none copy
- Focused inventing + bypass proofs in
  `tests/inventoryDetailCategoryAsciiC.test.ts`

## Alone-OK

Leaves Inventory detail supplier_name (#1052), Inventory detail title
item.item_name (#1017), Inventory hub item.item_name (#1056), Inventory
categoryIcon classify (#701), setup POS itemName/category (#872), Square
catalog category (#952), and Scan Item row meta category interpolations alone.

Ordinary conflict only on `app/inventory/[id].tsx` + `i18n/catalog.ts` when
#1052 lands; no shared identity modules; no migration.

## Verification

- focused `tests/inventoryDetailCategoryAsciiC.test.ts`: 5/5
  (52 assertion call sites counted from source before run)
- `npm run typecheck`: passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited
  recalculationCycles `withTimeout`; fixed in #1183, not landed)
- No migration. Docker pgTAP not run in this environment.
