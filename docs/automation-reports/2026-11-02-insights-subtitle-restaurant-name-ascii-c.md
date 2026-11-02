# MISE-005WC Insights subtitle restaurant.name ASCII C (2026-11-02)

## Defect

Insights hub subtitle restaurant interpolation used:

```ts
restaurant
  ? t("insights.subtitleRestaurantStyle", {
      restaurant: restaurant.name,
      style: serviceLabel ?? restaurant.cuisine_type ?? t("settings.profile.cuisineFallback")
    })
  : t("insights.subtitle")
```

Unicode-only-space and empty string restaurant names are still present on a
restaurant object, so the intentional generic `insights.subtitle` copy was
bypassed and the hub subtitle could interpolate a blank-looking restaurant
identity (`" · {style} brief"`). Unicode `.trim()` on padded restaurant names
would invent clean display restaurant identities before interpolating into
`insights.subtitleRestaurantStyle`.

## Fix

- `services/domain/presentationInsightsSubtitleRestaurantNameIdentity.ts`
- Soft-null via `normalizeInsightsSubtitleRestaurantName` (ASCII C single-line:
  ASCII end trim only; preserve NBSP — no fold; full C0/DEL reject) before the
  styled-subtitle branch on `app/(tabs)/insights.tsx` (1 site). Soft-null names
  fall through to `t("insights.subtitle")`.

## Ownership

Owns only Insights hub subtitle `{restaurant}` presentation for
`insights.subtitleRestaurantStyle` → `insights.subtitle` fallback. Does **not**
own Insights analytics profile restaurant-name chip (#969 / MISE-005UE),
Insights subtitle cuisine_type / cuisineFallback (#1029 / MISE-005VU), Settings
profile restaurant name (#1021 / MISE-005VM), Sales Import hero restaurant name
(#1022 / MISE-005VN), Today screen title restaurant-name (#968 / MISE-005UD),
restaurant branding initials (#967 / MISE-005UC), Settings workspace
`item.name`, inventory/count/privacy/support `subtitleRestaurant`
interpolations, or Home ApprovalsSection card titles. Alone-OK relative to
#969/#1029/#1021/#1022/#968/#967.

## Inventing / bypass proof

- Restaurant object + `"\u2003"` name previously still chose
  `insights.subtitleRestaurantStyle` and interpolated blank-looking identity
- Restaurant object + `""` name same bypass of `insights.subtitle`
- `"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"` inventing equality
- ASCII C soft-null restores the localized `insights.subtitle` fallback

## Verification

- Focused `tests/insightsSubtitleRestaurantNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test` (expect inherited recalculationCycles cancellations only)
