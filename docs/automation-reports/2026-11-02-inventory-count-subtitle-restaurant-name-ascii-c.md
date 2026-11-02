# MISE-005WF Inventory Count subtitle restaurant.name ASCII C (2026-11-02)

## Defect

Inventory Count subtitle restaurant interpolation used:

```ts
subtitle={t("inventory.count.subtitleRestaurant", { restaurant: restaurant.name })}
```

after an early `!restaurant` return that already owned `inventory.count.subtitle`.
Unicode-only-space and empty string restaurant names are still present on a
restaurant object, so the intentional generic `inventory.count.subtitle` copy
was bypassed and the Inventory Count subtitle could interpolate a blank-looking
restaurant identity. Unicode `.trim()` on padded restaurant names would invent
clean display restaurant identities before interpolating into
`inventory.count.subtitleRestaurant`.

## Fix

- `services/domain/presentationInventoryCountSubtitleRestaurantNameIdentity.ts`
- Soft-null via `normalizeInventoryCountSubtitleRestaurantName` (ASCII C
  single-line: ASCII end trim only; preserve NBSP — no fold; full C0/DEL
  reject) before the restaurant-subtitle branch on `app/inventory/count.tsx`
  (1 site). Soft-null names fall through to `t("inventory.count.subtitle")`.

## Ownership

Owns only Inventory Count subtitle `{restaurant}` presentation for
`inventory.count.subtitleRestaurant` → `inventory.count.subtitle` fallback.
Does **not** own Support Settings subtitle restaurant.name (#1039 /
MISE-005WE), Privacy Settings subtitle restaurant.name (#1036 / MISE-005WD),
Insights hub subtitle restaurant.name (#1037 / MISE-005WC), Insights analytics
profile restaurant-name chip (#969 / MISE-005UE), Insights subtitle
cuisine_type (#1029 / MISE-005VU), Settings profile restaurant name (#1021 /
MISE-005VM), Sales Import hero restaurant name (#1022 / MISE-005VN), Today
screen title restaurant-name (#968 / MISE-005UD), restaurant branding initials
(#967 / MISE-005UC), inventory hub `inventory.subtitleRestaurant`, Settings
workspace `item.name`, or Home ApprovalsSection card titles. Alone-OK relative
to those open tips.

## Inventing / bypass proof

- Restaurant object + `"\u2003"` name previously still chose
  `inventory.count.subtitleRestaurant` and interpolated blank-looking identity
- Restaurant object + `""` name same bypass of `inventory.count.subtitle`
- `"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"` inventing equality
- ASCII C soft-null restores the localized `inventory.count.subtitle` fallback

## Verification

- Focused `tests/inventoryCountSubtitleRestaurantNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test` (expect inherited recalculationCycles cancellations only)
