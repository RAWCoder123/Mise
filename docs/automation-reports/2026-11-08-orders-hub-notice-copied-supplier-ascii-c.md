# MISE-005AAC — Orders hub notice.copied supplier_name ASCII C

Date: 2026-11-08  
Branch: `cursor/mise-orders-hub-notice-copied-supplier-ascii-c`

## Defect

Orders hub always interpolated raw `order.supplier_name` into the copied-order
StatusNotice:

```ts
t("orders.notice.copied", { supplier: order.supplier_name })
```

Empty string rendered a blank-looking supplier identity. A Unicode-only-space
supplier name (`"\u2003"`) is truthy and rendered the same blank-looking
identity (`" order copied."`). Unicode `.trim()` on a padded supplier name
would invent a clean display label
(`"\u2003Sysco\u2003".trim() === "Sysco"`).

Open tip #1057 (Orders hub notice item_name) explicitly left this copied
supplier notice path alone.

## Fix

- `services/domain/presentationOrdersHubNoticeCopiedSupplierNameIdentity.ts` —
  ASCII C single-line end trim; preserve NBSP; full C0/DEL reject; soft-null
- `app/(tabs)/orders.tsx` — `copyOrder` notice through
  `normalizeOrdersHubNoticeCopiedSupplierName` with localized
  `orders.notice.supplierName.none` fallback
- `i18n/catalog.ts` — EN / ES / zh-Hans none copy
- Focused inventing + bypass proofs in
  `tests/ordersHubNoticeCopiedSupplierNameAsciiC.test.ts`

## Alone-OK

Leaves Orders hub notice item_name (#1057), SupplierDraftCard supplier_name
(#1050), Orders review supplier_name (#1051), Orders detail title (#1016) /
action a11y (#1068), and `order_copied` telemetry `supplier_name` alone.

## Verification

- focused `tests/ordersHubNoticeCopiedSupplierNameAsciiC.test.ts`: 5/5
  (52 assertion call sites counted from source before run)
- `npm run typecheck`: passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited
  recalculationCycles `withTimeout`; fixed in #1183, not landed)
- No migration. Docker pgTAP not run in this environment.
