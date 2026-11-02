# MISE-005WH Restaurant Memory subtitle restaurant.name ASCII C (2026-11-02)

## Defect

Restaurant Memory subtitle restaurant interpolation used:

```ts
restaurant
  ? t("memory.subtitle", { restaurant: restaurant.name })
  : t("memory.subtitle.none")
```

Unicode-only-space and empty string restaurant names are still present on a
restaurant object, so the intentional generic `memory.subtitle.none` copy was
bypassed and the Restaurant Memory subtitle could interpolate a blank-looking
restaurant identity. Unicode `.trim()` on padded restaurant names would invent
clean display restaurant identities before interpolating into
`memory.subtitle`.

## Fix

- `services/domain/presentationMemorySubtitleRestaurantNameIdentity.ts`
- Soft-null via `normalizeMemorySubtitleRestaurantName` (ASCII C single-line:
  ASCII end trim only; preserve NBSP — no fold; full C0/DEL reject) before the
  restaurant-subtitle branch on `app/more/restaurant-memory.tsx` (1 site). Soft-null
  names fall through to `t("memory.subtitle.none")`.

## Ownership

Owns only Restaurant Memory subtitle `{restaurant}` presentation for
`memory.subtitle` → `memory.subtitle.none` fallback. Does **not** own Autonomy
subtitle restaurant.name (sibling tip candidate), Activity History subtitle
restaurant.name (#1041 / MISE-005WG), Support Settings subtitle restaurant.name
(#1039 / MISE-005WE), Privacy Settings subtitle restaurant.name (#1036 /
MISE-005WD), Insights hub subtitle restaurant.name (#1037 / MISE-005WC),
Inventory Count subtitle restaurant.name (#1040 / MISE-005WF), Settings profile
restaurant name (#1021 / MISE-005VM), Sales Import hero restaurant name (#1022 /
MISE-005VN), Today screen title restaurant-name (#968 / MISE-005UD), restaurant
branding initials (#967 / MISE-005UC), Settings workspace `item.name`, or Home
ApprovalsSection card titles. Alone-OK relative to those open tips and sibling
candidates.

## Inventing / bypass proof

- Restaurant object + `"\u2003"` name previously still chose `memory.subtitle`
  and interpolated blank-looking identity
- Restaurant object + `""` name same bypass of `memory.subtitle.none`
- `"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"` inventing equality
- ASCII C soft-null restores the localized `memory.subtitle.none` fallback

## Verification

- Focused `tests/memorySubtitleRestaurantNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test` (expect inherited recalculationCycles cancellations only)
