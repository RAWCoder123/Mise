# MISE-005VJ Waste / daily-report itemName ASCII C (2026-11-01)

- Branch: `cursor/mise-waste-item-name-ascii-c`
- Base: `origin/main` @ `78da737`

## Inventing / bypass proof

Waste recent-event titles and waste/daily-report action-copy interpolations
rendered itemName with nullish coalescing before the intentional localized
fallback:

```ts
event.itemName ?? t("waste.event.unknownItem")
item?.itemName ?? t("waste.event.unknownItem")
```

A Unicode-only-space item name (`"\u2003"`) is non-nullish
(`("\u2003" ?? FALLBACK) === "\u2003"`), so `waste.event.unknownItem` was
bypassed and the UI could render a blank-looking waste item label or
interpolate blank padding into action copy. Empty string has the same `??`
bypass. Separately, Unicode `.trim()` on padded item names
(`"\u2003Roma Tomatoes\u2003".trim() === "Roma Tomatoes"`) would invent a
clean display item name.

Open #1017 / MISE-005VI owns Inventory detail Screen title `item_name` only
and explicitly left these waste `itemName ??` rows alone. Single-line name
tips preserve NBSP (no fold).

## Change

- `services/domain/presentationWasteItemNameIdentity.ts` — ASCII end trim
  only; soft-null on Unicode padding / controls / non-string; leave
  `|| t("waste.event.unknownItem")` to the call sites.
- `app/more/waste.tsx` — route recent-event title and action-copy item through
  `normalizeWasteItemName`.
- `app/more/daily-report.tsx` — route daily waste action-copy item through
  `normalizeWasteItemName`.
- Tests: `tests/wasteItemNameAsciiC.test.ts` (5/5).
- Left Inventory detail title item_name (#1017), Settings/Gmail
  `sender_email` (#candidate), Orders gmail `fallbackSender` (#candidate),
  Orders detail title supplier_name (#1016), Home StatusNotice approval
  title (#1011), setup.fallback.* (#1012), activityEvents hard-coded
  English `itemName ?? "Inventory"`, and setupDrafts emptiness-only
  `(record.itemName ?? "").trim()` alone.

## Verification

- focused `tests/wasteItemNameAsciiC.test.ts`: 5/5
- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles`); tip +5 vs main ~683
- Docker pgTAP unavailable in this environment

## Do not

- Share module with #1017 / #1016 / #1015 / #1014 / #1013 / #1012 / #1011
- Re-tip these waste / daily-report `itemName ?? waste.event.unknownItem` rows
- Tip Settings/Gmail `sender_email` or Orders gmail `fallbackSender` as
  covered by this tip
