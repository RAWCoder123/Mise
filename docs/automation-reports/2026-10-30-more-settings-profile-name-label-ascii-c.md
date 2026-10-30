# MISE-005TZ More/Settings profile name label ASCII C (2026-10-30)

- Branch: `cursor/mise-more-settings-profile-name-label-ascii-c`
- Base: `origin/main` @ `78da737`

## Inventing proof

More and Settings profile chrome used
`user?.name?.trim() || t("more.profile.fallbackName")` /
`user?.name?.trim() || t("settings.account.title")`.
Unicode `.trim()` stripped em-space / NBSP padding before rendering, so
`'\u2003Alex Rivera\u2003'.trim()` invented a clean profile name label, and
soft Unicode-only space collapsed into the intentional i18n fallback.

Not owned by open #963 (Create Task assignee chip labels), #962 (More/Settings
profile initials), #961 (Home/Ask Mise greeting firstName), #960 (outreach
greeting firstName), #849 (user profile display name), Settings account email
label `.trim()` display, team member directory labels, or
`utils/restaurantBranding` / `utils/screenTitles` restaurant initials. Open
#962 explicitly left More/Settings profile **name** label `.trim()` display
alone.

## Change

- `services/domain/presentationProfileNameLabelIdentity.ts` — ASCII end trim
  only; soft-null on Unicode padding / controls / non-string; leave
  `|| t("more.profile.fallbackName")` /
  `|| t("settings.account.title")` to the call sites.
- `app/(tabs)/more.tsx` and `app/(tabs)/settings.tsx` — route profile name
  labels through `presentationProfileNameLabel`.
- Tests: `tests/presentationProfileNameLabelAsciiC.test.ts` (3/3).
- Left More/Settings avatar `initialsFor`, Settings email `.trim()` label,
  Create Task assignee labels, and team directory labels on their own tips.

## Verification

- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- focused More/Settings profile name label ASCII C tests: 3/3
- `npm test`: 686 total / 679 pass / 0 fail / 7 cancelled (inherited
  recalculationCycles `withTimeout`); tip +3 vs main ~683
- Docker pgTAP unavailable in this environment

## Do not

- Share module with #963 / #962 / #961 / #960 / #849
- Re-tip this More/Settings profile name label field
- Tip Settings email label, team directory labels, Create Task assignee
  labels, or restaurantBranding/screenTitles initials as covered by this tip
