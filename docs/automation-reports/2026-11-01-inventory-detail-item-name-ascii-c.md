# MISE-005VI Inventory detail Screen title item_name ASCII C (2026-11-01)

- Branch: `cursor/mise-inventory-detail-item-name-ascii-c`
- Base: `origin/main` @ `78da737`

## Inventing / bypass proof

Inventory detail Screen title rendered item_name with nullish coalescing
before the intentional localized fallback:

```ts
item?.item_name ?? t("inventory.detail.title")
```

A Unicode-only-space item name (`"\u2003"`) is non-nullish
(`("\u2003" ?? FALLBACK) === "\u2003"`), so `inventory.detail.title` was bypassed
and the Screen could render a blank-looking title. Empty string has the same
`??` bypass. Separately, Unicode `.trim()` on padded item names
(`"\u2003Roma Tomatoes\u2003".trim() === "Roma Tomatoes"`) would invent a clean
display title.

Open #1016 / MISE-005VH owns Orders detail Screen title `supplier_name` only
and explicitly left this Inventory detail `item_name ??` row alone. Single-line
name tips preserve NBSP (no fold).

## Change

- `services/domain/presentationInventoryDetailItemNameIdentity.ts` — ASCII end
  trim only; soft-null on Unicode padding / controls / non-string; leave
  `|| t("inventory.detail.title")` to the call site.
- `app/inventory/[id].tsx` — route Screen title through
  `normalizeInventoryDetailItemName`.
- Tests: `tests/inventoryDetailItemNameAsciiC.test.ts` (5/5).
- Left waste `itemName` (#candidate), Settings/Gmail `sender_email`
  (#candidate), Orders gmail `fallbackSender` (#candidate), Orders detail
  title supplier_name (#1016), Home StatusNotice approval title (#1011),
  setup.fallback.* (#1012), and this screen's add-action a11y
  `item.item_name` interpolation alone.

## Verification

- focused `tests/inventoryDetailItemNameAsciiC.test.ts`: 5/5
- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles`); tip +5 vs main ~683
- Docker pgTAP unavailable in this environment

## Do not

- Share module with #1016 / #1015 / #1014 / #1013 / #1012 / #1011
- Re-tip this Screen title `item_name ?? inventory.detail.title` row
- Tip waste `itemName`, Gmail `sender_email`, or Orders gmail
  `fallbackSender` as covered by this tip
