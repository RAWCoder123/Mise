# MISE-005VH Orders detail Screen title supplier_name ASCII C (2026-11-01)

- Branch: `cursor/mise-orders-detail-title-supplier-name-ascii-c`
- Base: `origin/main` @ `78da737`

## Inventing / bypass proof

Orders detail Screen title rendered supplier_name with nullish coalescing
before the intentional localized fallback:

```ts
visibleOrder?.supplier_name ?? t("orders.detail.title")
```

A Unicode-only-space supplier name (`"\u2003"`) is non-nullish
(`("\u2003" ?? FALLBACK) === "\u2003"`), so `orders.detail.title` was bypassed
and the Screen could render a blank-looking title. Empty string has the same
`??` bypass. Separately, Unicode `.trim()` on padded supplier names
(`"\u2003Acme Foods\u2003".trim() === "Acme Foods"`) would invent a clean
display title.

Open #1015 / MISE-005VG owns email-review From/To/Subject only and explicitly
left this Screen title `??` row alone. Single-line name tips preserve NBSP (no
fold).

## Change

- `services/domain/ordersDetailTitleSupplierNameIdentity.ts` — ASCII end trim
  only; soft-null on Unicode padding / controls / non-string; leave
  `|| t("orders.detail.title")` to the call site.
- `app/orders/[id].tsx` — route Screen title through
  `normalizeOrdersDetailTitleSupplierName`.
- Tests: `tests/ordersDetailTitleSupplierNameAsciiC.test.ts` (5/5).
- Left email-review headers (#1015), body (#1014), note.none (#1013),
  operator_note (#840), durable send From/To (#708), durable send subject
  (#913), delivery-evidence (#1010), receive-discrepancy (#670), and other
  `visibleOrder.supplier_name` a11y/action interpolations alone.

## Verification

- focused `tests/ordersDetailTitleSupplierNameAsciiC.test.ts`: 5/5
- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles`); tip +5 vs main ~683
- Docker pgTAP unavailable in this environment

## Do not

- Share module with #1015 / #1014 / #1013 / #840 / #708 / #913 / #1010 / #670
- Re-tip this Screen title `supplier_name ?? orders.detail.title` row
- Tip email-review headers/body, note.none, inventory detail `item_name`,
  waste `itemName`, or Gmail `sender_email` as covered by this tip
