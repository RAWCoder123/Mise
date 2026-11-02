# MISE-005WG Activity subtitle restaurant.name ASCII C (2026-11-02)

## Defect

Activity History subtitle restaurant interpolation used:

```ts
restaurant
  ? t("activity.subtitle", { restaurant: restaurant.name })
  : t("activity.subtitle.none")
```

Unicode-only-space and empty string restaurant names are still present on a
restaurant object, so the intentional generic `activity.subtitle.none` copy was
bypassed and the Activity History subtitle could interpolate a blank-looking
restaurant identity. Unicode `.trim()` on padded restaurant names would invent
clean display restaurant identities before interpolating into
`activity.subtitle`.

## Fix

- `services/domain/presentationActivitySubtitleRestaurantNameIdentity.ts`
- Soft-null via `normalizeActivitySubtitleRestaurantName` (ASCII C single-line:
  ASCII end trim only; preserve NBSP — no fold; full C0/DEL reject) before the
  restaurant-subtitle branch on `app/more/activity.tsx` (1 site). Soft-null
  names fall through to `t("activity.subtitle.none")`.

## Ownership

Owns only Activity History subtitle `{restaurant}` presentation for
`activity.subtitle` → `activity.subtitle.none` fallback. Does **not** own
Support Settings subtitle restaurant.name (#1039 / MISE-005WE), Privacy
Settings subtitle restaurant.name (#1036 / MISE-005WD), Insights hub subtitle
restaurant.name (#1037 / MISE-005WC), Inventory Count subtitle restaurant.name
(#1040 / MISE-005WF), Restaurant Memory subtitle restaurant.name, Autonomy
subtitle restaurant.name, Settings profile restaurant name (#1021 /
MISE-005VM), Sales Import hero restaurant name (#1022 / MISE-005VN), Today
screen title restaurant-name (#968 / MISE-005UD), restaurant branding initials
(#967 / MISE-005UC), Settings workspace `item.name`, or Home ApprovalsSection
card titles. Alone-OK relative to those open tips and sibling candidates.

## Inventing / bypass proof

- Restaurant object + `"\u2003"` name previously still chose `activity.subtitle`
  and interpolated blank-looking identity
- Restaurant object + `""` name same bypass of `activity.subtitle.none`
- `"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"` inventing equality
- ASCII C soft-null restores the localized `activity.subtitle.none` fallback

## Verification

- Focused `tests/activitySubtitleRestaurantNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test` (expect inherited recalculationCycles cancellations only)
