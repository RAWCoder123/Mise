# MISE-005UF Insights profile cuisine-type ASCII C

Date: 2026-10-30

## Inventing proof

Insights Sales Analytics profile used
`cuisineType?.trim() || t("insights.analytics.profile.unknown")`.

```text
'\u2003Italian\u2003'.trim() === 'Italian'
```

Unicode `String#trim` invented a clean cuisine-type label for Insights
profile chrome. Soft empty / Unicode-only space also collapsed into the
intentional unknown-profile i18n fallback.

## Change

- Added `services/domain/presentationInsightsProfileCuisineTypeIdentity.ts`
- Wired `app/(tabs)/insights.tsx` cuisine ProfileChip through
  `presentationInsightsProfileCuisineType`
- Added `tests/presentationInsightsProfileCuisineTypeAsciiC.test.ts`

Soft-null when Unicode padding remains, controls appear, or non-string.
Soft-null preserves the intentional unknown-profile i18n fallback. Full
cuisine type remains the profile seed (not a first-token slice).

## Ownership

Separate from Insights restaurant-name profile chip (#969 / MISE-005UE),
Today screen title restaurant-name (#968), restaurant branding initials
(#967), Settings account email (#966), Team directory (#965), More/Settings
profile name (#964), Create Task assignee (#963), profile initials (#962),
greeting firstName (#961/#960), and outreach-webhook From (#959).

Left Insights restaurant-name profile chip `.trim()` alone for open tip
#969.

## Verification

- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- focused presentationInsightsProfileCuisineTypeAsciiC tests
- `npm test`
