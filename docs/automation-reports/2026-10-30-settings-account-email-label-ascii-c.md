# MISE-005UB Settings account email label ASCII C (2026-10-30)

- Branch: `cursor/mise-settings-account-email-label-ascii-c`
- Base: `origin/main` @ `78da737`

## Inventing proof

Settings account chrome used
`user?.email?.trim() || t("settings.account.emailMissing")`.
Unicode `.trim()` stripped em-space / NBSP padding before rendering, so
`'\u2003chef@example.com\u2003'.trim()` invented a clean account email label,
and soft Unicode-only space collapsed into the intentional i18n email-missing
fallback.

Not owned by open #965 (Team Settings directory labels), #964 (More/Settings
profile name labels), #963 (Create Task assignee chip labels), #962
(More/Settings profile initials), #961 (Home/Ask Mise greeting firstName),
#960 (outreach greeting firstName), #959 (outreach-webhook From mailbox),
#849 (user profile display name), `normalizeTeamMemberEmail` (#674 / #435),
`normalizeOutreachEmail` (#420), or `utils/restaurantBranding` /
`utils/screenTitles` restaurant initials. Open #965 / #964 explicitly left
Settings account email label `.trim()` display alone.

## Change

- `services/domain/presentationSettingsAccountEmailLabelIdentity.ts` — ASCII
  end trim only; soft-null on Unicode padding / controls / non-string; leave
  `|| t("settings.account.emailMissing")` to the call site.
- `app/(tabs)/settings.tsx` — route account email label through
  `presentationSettingsAccountEmailLabel`.
- Tests: `tests/presentationSettingsAccountEmailLabelAsciiC.test.ts` (3/3).
- Left Settings profile name `.trim()` label, More/Settings avatar
  `initialsFor`, Create Task assignee labels, and team directory labels on
  their own tips.

## Verification

- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- focused Settings account email label ASCII C tests: 3/3
- `npm test`: 686 total / 679 pass / 0 fail / 7 cancelled (inherited
  recalculationCycles `withTimeout`); tip +3 vs main ~683
- Docker pgTAP unavailable in this environment

## Do not

- Share module with #965 / #964 / #963 / #962 / #961 / #960 / #959 / #849 /
  #420 / #674
- Re-tip this Settings account email label field
- Tip Team Settings directory labels, More/Settings profile name labels,
  Create Task assignee labels, profile initials, or restaurantBranding /
  screenTitles initials as covered by this tip
