# MISE-005UE Insights profile restaurant-name ASCII C (2026-10-30)

- Branch: `cursor/mise-insights-profile-restaurant-name-ascii-c`
- Base: `origin/main` @ `78da737`

## Inventing proof

Insights Sales Analytics profile chrome used
`restaurantName?.trim() || t("insights.analytics.profile.unknown")`.
Unicode `.trim()` stripped em-space / NBSP padding before rendering, so
`'\u2003Luna Bistro\u2003'.trim()` invented a clean restaurant-name label,
and soft Unicode-only space collapsed into the intentional i18n
unknown-profile fallback.

Not owned by open #968 (Today screen title restaurant-name), #967
(restaurant branding initials), #966 (Settings account email labels),
#965 (Team Settings directory labels), #964 (More/Settings profile name
labels), #963 (Create Task assignee chip labels), #962 (More/Settings
profile initials), #961 (Home/Ask Mise greeting firstName), #960
(outreach greeting firstName), #959 (outreach-webhook From mailbox), or
#849 (user profile display name). Insights cuisine-type profile chip
`cuisineType?.trim()` is left alone for a later tip.

## Change

- `services/domain/presentationInsightsProfileRestaurantNameIdentity.ts` —
  ASCII end trim only; soft-null on Unicode padding / controls /
  non-string; leave `|| t("insights.analytics.profile.unknown")` to the
  call site. Full restaurant name (not a first-token slice) is the seed.
- `app/(tabs)/insights.tsx` — route Insights profile restaurant chip
  through `presentationInsightsProfileRestaurantName`.
- Tests: `tests/presentationInsightsProfileRestaurantNameAsciiC.test.ts`
  (3/3).
- Left Insights cuisine-type profile chip `.trim()`, Today screen title
  restaurant-name prep, restaurant branding initials, and Settings
  account email / profile name labels on their own tips.

## Verification

- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- focused Insights profile restaurant-name ASCII C tests: 3/3
- `npm test`: 686 total / 679 pass / 0 fail / 7 cancelled (inherited
  recalculationCycles `withTimeout`); tip +3 vs main ~683
- Docker pgTAP unavailable in this environment

## Do not

- Share module with #968 / #967 / #966 / #965 / #964 / #963 / #962 / #961 /
  #960 / #959 / #849
- Re-tip this Insights profile restaurant-name field
- Tip Insights cuisine-type profile chip, Today screen title
  restaurant-name, or restaurant branding initials as covered by this tip
