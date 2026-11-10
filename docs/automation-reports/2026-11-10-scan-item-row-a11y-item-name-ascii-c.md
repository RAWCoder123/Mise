# MISE-005ABP Scan Item row a11y item.item_name ASCII C (2026-11-10)

## Defect

Scan Item list rows always interpolated raw `item.item_name` into
`scanItem.row.accessibility` accessibility labels. Empty / Unicode-only-space
names rendered blank-looking item identity with no intentional localized
fallback. Unicode `.trim()` on padded names would invent a clean item label.

## Fix

- `presentationScanItemRowAccessibilityItemNameIdentity.ts` — ASCII C single-line
  prep (end trim only; preserve NBSP; full C0/DEL reject)
- Soft-null via `normalizeScanItemRowAccessibilityItemName` before
  `scanItem.row.accessibility` a11y interpolation
- Localized fallback `scanItem.row.accessibility.item.none` (EN/ES/zh-Hans)

## Alone-OK

Leaves OperationalRow `title={item.item_name}` display (#1061 / MISE-005XA),
Log Delivery pick-list title (#1059 / MISE-005WY), Log Delivery selected.item_name
(#1060 / MISE-005WZ), history entry.itemName (#1062 / MISE-005XB), Log Delivery
row a11y (#1226 / MISE-005ABO), and Waste reviewItem a11y (#1073 / MISE-005XM)
alone. Distinct module from #1061's Scan Item row display identity helpers so
this a11y-only tip can land independently of the display tip.

## Verification

- focused `tests/scanItemRowAccessibilityItemNameAsciiC.test.ts` (5/5; 52 assertion call sites from source)
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm test` (688 total / 688 pass / 0 fail / 0 cancelled)
