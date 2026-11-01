# MISE-005VO Settings workspace cuisine_type ASCII C (2026-11-01)

## Defect

Settings workspace switcher meta used:

```ts
item.cuisine_type ?? t("settings.workspace.metaFallback")
```

Unicode-only-space and empty string are non-nullish under `??`, bypassing
localized `settings.workspace.metaFallback` copy. Unicode `.trim()` on padded
cuisine types would invent clean display cuisine identities.

## Fix

- `services/domain/presentationSettingsWorkspaceCuisineIdentity.ts`
- Soft-null via `normalizeSettingsWorkspaceCuisine` (ASCII C single-line:
  ASCII end trim only; preserve NBSP — no fold; full C0/DEL reject) before
  `|| t("settings.workspace.metaFallback")` on `app/(tabs)/settings.tsx` (1 site)

## Ownership

Owns only Settings workspace switcher `settings.workspace.metaFallback`
cuisine_type presentation. Does **not** own workspace switcher `item.name`,
Settings hub restaurant-name (#1021), Sales Import hero restaurant-name
(#1022), Insights profile restaurant-name / cuisineFallback (#969), Today
screen title restaurant-name (#968), branding initials / hard-coded English
cuisine (#967), Settings account email (#966), Team directory (#965),
More/Settings profile name (#964), durable `requireRestaurantName` (#844),
Orders gmail connected-body sender (#1020), Settings/Gmail sender_email
(#1019), POS mappings suggestedMenuItemName / selectedMenuItem.name, or Home
ApprovalsSection card titles. Alone-OK relative to
#1022/#1021/#1020/#1019/#969/#968/#967/#966/#965/#964/#844.

## Inventing / bypass proof

- `("\u2003" ?? FALLBACK) === "\u2003"` bypasses `?? t("settings.workspace.metaFallback")`
- `("" ?? FALLBACK) === ""` same bypass
- `"\u2003Coastal Seafood\u2003".trim() === "Coastal Seafood"` inventing equality
- ASCII C soft-null restores the localized metaFallback

## Verification

- Focused `tests/settingsWorkspaceCuisineAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test` (expect inherited recalculationCycles cancellations only)
