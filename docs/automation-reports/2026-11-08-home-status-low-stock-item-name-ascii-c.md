# MISE-005ZT: pin Home StatusNotice low-stock itemName to ASCII C

Date: 2026-11-08  
Branch: `cursor/mise-home-status-low-stock-item-name-ascii-c`  
Baseline: `origin/main` @ `78da7376`

## Summary

Home `RestaurantStatusCard` always passed raw `primaryMenuRisk.itemName`
(from `item.item_name`) into `home.alert.lowStock.itemTitle` whenever a
menu-risk outlook row was present. Empty / Unicode-only-space names rendered
blank-looking low-stock titles; Unicode `.trim()` on padded names would invent
a clean inventory label before interpolation.

## Changes

- Add `services/domain/presentationHomeStatusLowStockItemNameIdentity.ts`
  (ASCII C single-line prep; soft-null on empty / Unicode-padded / controls)
- Route StatusNotice low-stock `{item}` through
  `normalizeHomeStatusLowStockItemName` so unsafe names fall through to new
  localized `home.alert.lowStock.itemName.none` (EN / ES / zh-Hans)
- Leave StatusNotice topRisk (#1138), summary (#1137), whyItMatters (#1136),
  approval titles (#1011), ApprovalsSection card surfaces (#1049 / #1134 /
  #1135), and Home greeting restaurant.name (#1044) alone

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered as the `{item}` slot
  with no localized none fallback
- `"\u2003Chicken Breast\u2003".trim() === "Chicken Breast"` inventing equality
- Source path: `buildOperatingOutlook` → `itemName: item.item_name`
- ASCII C soft-null restores `home.alert.lowStock.itemName.none`

## Verification

- Focused `tests/homeStatusLowStockItemNameAsciiC.test.ts` — 5/5
- Assertion call sites counted from source: **81**
- `npm run typecheck` — passed
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm test` — 688 total / 681 pass / 0 fail / 7 cancelled (inherited `recalculationCycles`)

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
