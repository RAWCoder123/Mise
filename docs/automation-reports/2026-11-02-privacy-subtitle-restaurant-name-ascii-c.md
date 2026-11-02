# MISE-005WD Privacy subtitle restaurant.name ASCII C (2026-11-02)

## Defect

Privacy Settings subtitle restaurant interpolation used:

```ts
signedIn && restaurant
  ? t("privacy.subtitleRestaurant", { restaurant: restaurant.name })
  : t("privacy.subtitle")
```

Unicode-only-space and empty string restaurant names are still present on a
restaurant object, so the intentional generic `privacy.subtitle` copy was
bypassed and the Privacy Settings subtitle could interpolate a blank-looking
restaurant identity. Unicode `.trim()` on padded restaurant names would invent
clean display restaurant identities before interpolating into
`privacy.subtitleRestaurant`.

## Fix

- `services/domain/presentationPrivacySubtitleRestaurantNameIdentity.ts`
- Soft-null via `normalizePrivacySubtitleRestaurantName` (ASCII C single-line:
  ASCII end trim only; preserve NBSP — no fold; full C0/DEL reject) before the
  restaurant-subtitle branch on `app/settings/privacy.tsx` (1 site). Soft-null
  names fall through to `t("privacy.subtitle")`.

## Ownership

Owns only Privacy Settings subtitle `{restaurant}` presentation for
`privacy.subtitleRestaurant` → `privacy.subtitle` fallback. Does **not** own
Insights hub subtitle restaurant.name (MISE-005WC), Insights analytics profile
restaurant-name chip (#969 / MISE-005UE), Insights subtitle cuisine_type
(#1029 / MISE-005VU), Settings profile restaurant name (#1021 / MISE-005VM),
Sales Import hero restaurant name (#1022 / MISE-005VN), Today screen title
restaurant-name (#968 / MISE-005UD), restaurant branding initials (#967 /
MISE-005UC), Settings workspace `item.name`, support/count
`subtitleRestaurant` interpolations, or Home ApprovalsSection card titles.
Alone-OK relative to those open tips.

## Inventing / bypass proof

- Signed-in restaurant object + `"\u2003"` name previously still chose
  `privacy.subtitleRestaurant` and interpolated blank-looking identity
- Signed-in restaurant object + `""` name same bypass of `privacy.subtitle`
- `"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"` inventing equality
- ASCII C soft-null restores the localized `privacy.subtitle` fallback

## Verification

- Focused `tests/privacySubtitleRestaurantNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test` (expect inherited recalculationCycles cancellations only)
