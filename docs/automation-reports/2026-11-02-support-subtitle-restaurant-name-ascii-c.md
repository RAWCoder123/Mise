# MISE-005WE Support subtitle restaurant.name ASCII C (2026-11-02)

## Defect

Support Settings subtitle restaurant interpolation used:

```ts
signedIn && restaurant
  ? t("support.subtitleRestaurant", { restaurant: restaurant.name })
  : t("support.subtitle")
```

Unicode-only-space and empty string restaurant names are still present on a
restaurant object, so the intentional generic `support.subtitle` copy was
bypassed and the Support Settings subtitle could interpolate a blank-looking
restaurant identity. Unicode `.trim()` on padded restaurant names would invent
clean display restaurant identities before interpolating into
`support.subtitleRestaurant`.

## Fix

- `services/domain/presentationSupportSubtitleRestaurantNameIdentity.ts`
- Soft-null via `normalizeSupportSubtitleRestaurantName` (ASCII C single-line:
  ASCII end trim only; preserve NBSP — no fold; full C0/DEL reject) before the
  restaurant-subtitle branch on `app/settings/support.tsx` (1 site). Soft-null
  names fall through to `t("support.subtitle")`.

## Ownership

Owns only Support Settings subtitle `{restaurant}` presentation for
`support.subtitleRestaurant` → `support.subtitle` fallback. Does **not** own
Privacy Settings subtitle restaurant.name (#1036 / MISE-005WD), Insights hub
subtitle restaurant.name (MISE-005WC), Insights analytics profile
restaurant-name chip (#969 / MISE-005UE), Insights subtitle cuisine_type
(#1029 / MISE-005VU), Settings profile restaurant name (#1021 / MISE-005VM),
Sales Import hero restaurant name (#1022 / MISE-005VN), Today screen title
restaurant-name (#968 / MISE-005UD), restaurant branding initials (#967 /
MISE-005UC), inventory count `subtitleRestaurant`, Settings workspace
`item.name`, or Home ApprovalsSection card titles. Alone-OK relative to those
open tips.

## Inventing / bypass proof

- Signed-in restaurant object + `"\u2003"` name previously still chose
  `support.subtitleRestaurant` and interpolated blank-looking identity
- Signed-in restaurant object + `""` name same bypass of `support.subtitle`
- `"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"` inventing equality
- ASCII C soft-null restores the localized `support.subtitle` fallback

## Verification

- Focused `tests/supportSubtitleRestaurantNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test` (expect inherited recalculationCycles cancellations only)
