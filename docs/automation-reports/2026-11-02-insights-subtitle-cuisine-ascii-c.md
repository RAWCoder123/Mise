# MISE-005VU Insights subtitle cuisine_type ASCII C (2026-11-02)

## Defect

Insights hub subtitle style used:

```ts
serviceLabel ?? restaurant.cuisine_type ?? t("settings.profile.cuisineFallback")
```

Unicode-only-space and empty string are non-nullish under `??`, bypassing
localized `settings.profile.cuisineFallback` copy when `serviceLabel` is
absent. Unicode `.trim()` on padded cuisine types would invent clean
display cuisine identities before interpolating into
`insights.subtitleRestaurantStyle`.

## Fix

- `services/domain/presentationInsightsSubtitleCuisineIdentity.ts`
- Soft-null via `normalizeInsightsSubtitleCuisine` (ASCII C single-line:
  ASCII end trim only; preserve NBSP — no fold; full C0/DEL reject) before
  `?? t("settings.profile.cuisineFallback")` on `app/(tabs)/insights.tsx`
  (1 site)

## Ownership

Owns only Insights hub subtitle `settings.profile.cuisineFallback`
cuisine_type presentation. Does **not** own Insights analytics profile
cuisine ProfileChip (#970 / MISE-005UF), Insights profile restaurant-name
chip (#969 / MISE-005UE), Settings workspace cuisine_type meta (#1023 /
MISE-005VO), Settings workspace switcher `item.name`, restaurant branding
hard-coded English cuisine (#967 / MISE-005UC), miseDomain
`"Cuisine not set"` evidence, subtitle `restaurant.name` pass-through, or
Home ApprovalsSection card titles. Alone-OK relative to
#970/#969/#1023/#967.

## Inventing / bypass proof

- `("\u2003" ?? FALLBACK) === "\u2003"` bypasses `?? t("settings.profile.cuisineFallback")`
- `("" ?? FALLBACK) === ""` same bypass
- `"\u2003Coastal Seafood\u2003".trim() === "Coastal Seafood"` inventing equality
- ASCII C soft-null restores the localized cuisineFallback

## Verification

- Focused `tests/insightsSubtitleCuisineAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test` (expect inherited recalculationCycles cancellations only)
