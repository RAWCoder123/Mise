# MISE-005UC restaurant branding initials ASCII C (2026-10-30)

- Branch: `cursor/mise-restaurant-branding-initials-ascii-c`
- Base: `origin/main` @ `78da737`

## Inventing proof

`utils/restaurantBranding` `restaurantInitials` used
`restaurant?.name?.trim()` before taking the first character of up to two
whitespace-separated tokens. Unicode `.trim()` stripped em-space / NBSP
padding before deriving initials, so
`'\u2003Luna Bistro\u2003'.trim().split(/\s+/).slice(0, 2)` invented clean
restaurant branding initials (`LB`), and soft Unicode-only space collapsed
into the intentional `"M"` empty-restaurant fallback.

Not owned by open #966 (Settings account email labels), #965 (Team Settings
directory labels), #964 (More/Settings profile name labels), #963 (Create Task
assignee chip labels), #962 (More/Settings profile initials), #961 (Home/Ask
Mise greeting firstName), #960 (outreach greeting firstName), #959
(outreach-webhook From mailbox), #849 (user profile display name), or
`utils/screenTitles` Today screen title restaurant-name prep. Open #962 /
#966 explicitly left `utils/restaurantBranding` restaurant initials alone.

## Change

- `services/domain/presentationRestaurantInitialsIdentity.ts` — ASCII end
  trim only; soft-null on Unicode padding / controls / non-string; preserve
  restaurant token selection (single-token `"Chef"` → `"C"`) and intentional
  `"M"` empty fallback.
- `utils/restaurantBranding.ts` — route `restaurantInitials` through
  `presentationRestaurantInitialsFromSeed(restaurant?.name)`.
- Tests: `tests/presentationRestaurantInitialsAsciiC.test.ts` (3/3).
- Left `utils/screenTitles` `restaurantName?.trim()` Today title prep, More /
  Settings profile avatar initials, and sibling presentation label tips alone.

## Verification

- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- focused restaurant branding initials ASCII C tests: 3/3
- `npm test`: 686 total / 679 pass / 0 fail / 7 cancelled (inherited
  recalculationCycles `withTimeout`); tip +3 vs main ~683
- Docker pgTAP unavailable in this environment

## Do not

- Share module with #966 / #965 / #964 / #963 / #962 / #961 / #960 / #959 /
  #849 or screenTitles Today title tip
- Re-tip this restaurant branding initials field
- Tip screenTitles Today title restaurant-name `.trim()`, profile initials,
  or Settings account email labels as covered by this tip
