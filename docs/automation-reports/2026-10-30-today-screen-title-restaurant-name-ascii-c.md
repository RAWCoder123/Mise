# MISE-005UD Today screen title restaurant-name ASCII C (2026-10-30)

- Branch: `cursor/mise-today-screen-title-restaurant-name-ascii-c`
- Base: `origin/main` @ `78da737`

## Inventing proof

`utils/screenTitles` `todayScreenTitle` used `restaurantName?.trim()` before
interpolating the restaurant name into chrome copy. Unicode `.trim()` stripped
em-space / NBSP padding before building the title, so
`'\u2003Luna Bistro\u2003'.trim()` invented a clean restaurant identity
(`Today at Luna Bistro`), and soft Unicode-only space collapsed into the
intentional `"Today at Mise"` fallback.

Not owned by open #967 (restaurant branding initials), #966 (Settings account
email labels), #965 (Team Settings directory labels), #964 (More/Settings
profile name labels), #963 (Create Task assignee chip labels), #962
(More/Settings profile initials), #961 (Home/Ask Mise greeting firstName),
#960 (outreach greeting firstName), #959 (outreach-webhook From mailbox), or
#849 (user profile display name). Open #967 / MISE-005UC explicitly left
`utils/screenTitles` Today title restaurant-name prep alone.

## Change

- `services/domain/presentationTodayScreenTitleIdentity.ts` — ASCII end trim
  only; soft-null on Unicode padding / controls / non-string; preserve the
  full restaurant name as the title seed and the intentional
  `"Today at Mise"` empty fallback.
- `utils/screenTitles.ts` — route `todayScreenTitle` through
  `normalizePresentationTodayScreenTitleRestaurantName(restaurantName)`.
- Tests: `tests/presentationTodayScreenTitleAsciiC.test.ts` (3/3).
- Left restaurant branding initials, More/Settings profile avatar initials,
  and sibling presentation label tips alone.

## Verification

- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- focused Today screen title ASCII C tests: 3/3
- `npm test`: 686 total / 679 pass / 0 fail / 7 cancelled (inherited
  recalculationCycles `withTimeout`); tip +3 vs main ~683
- Docker pgTAP unavailable in this environment

## Do not

- Share module with #967 / #966 / #965 / #964 / #963 / #962 / #961 / #960 /
  #959 / #849
- Re-tip this Today screen title restaurant-name field
- Tip restaurant branding initials or Settings account email labels as
  covered by this tip
