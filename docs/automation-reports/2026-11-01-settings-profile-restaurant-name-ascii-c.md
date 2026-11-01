# MISE-005VM Settings profile restaurant name ASCII C (2026-11-01)

## Defect

Settings hub restaurant OperationalRow used:

```ts
restaurant?.name ?? t("settings.profile.noRestaurant")
```

Unicode-only-space and empty string are non-nullish under `??`, bypassing
localized `settings.profile.noRestaurant` copy. Unicode `.trim()` on padded
restaurant names would invent clean display restaurant identities.

## Fix

- `services/domain/presentationSettingsProfileRestaurantNameIdentity.ts`
- Soft-null via `normalizeSettingsProfileRestaurantName` (ASCII C single-line:
  ASCII end trim only; preserve NBSP — no fold; full C0/DEL reject) before
  `|| t("settings.profile.noRestaurant")` on `app/(tabs)/settings.tsx` (1 site)

## Ownership

Owns only Settings hub `settings.profile.noRestaurant` restaurant-name
presentation. Does **not** own Insights profile restaurant-name (#969), Today
screen title restaurant-name (#968), branding initials (#967), Settings
account email (#966), Team directory labels (#965), More/Settings profile
name (#964), durable `requireRestaurantName` (#844), workspace switcher
`item.name` / `cuisine_type ?? metaFallback`, sales-import
`restaurant?.name ?? common.notSet`, or Home ApprovalsSection card titles.
Alone-OK relative to #969/#968/#967/#966/#965/#964/#844.

## Inventing / bypass proof

- `("\u2003" ?? FALLBACK) === "\u2003"` bypasses `?? t("settings.profile.noRestaurant")`
- `("" ?? FALLBACK) === ""` same bypass
- `"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"` inventing equality
- ASCII C soft-null restores the localized noRestaurant headline

## Verification

- Focused `tests/settingsProfileRestaurantNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test` (expect inherited recalculationCycles cancellations only)
