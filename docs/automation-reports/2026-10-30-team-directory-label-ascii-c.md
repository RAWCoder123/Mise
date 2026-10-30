# MISE-005UA Team Settings directory label ASCII C (2026-10-30)

- Branch: `cursor/mise-team-directory-label-ascii-c`
- Base: `origin/main` @ `78da737`

## Inventing proof

Team Settings directory member chrome used
`member.name?.trim() || member.email?.trim() || t("team.member.unnamed")` for
the primary label and `member.email?.trim() || t("team.member.emailMissing")`
for the email subtitle. Unicode `.trim()` stripped em-space / NBSP padding
before rendering, so `'\u2003Alex Rivera\u2003'.trim()` invented a clean
directory name, and a padded email invented a clean email fallback / subtitle.

Not owned by open #964 (More/Settings profile name labels), #963 (Create Task
assignee chip labels), #962 (More/Settings profile initials), #961 (Home/Ask
Mise greeting firstName), #960 (outreach greeting firstName), #849 (user
profile display name), Settings account email label `.trim()` display,
`normalizeTeamMemberEmail` invite / candidate email identity (#674 / #435),
or `utils/restaurantBranding` / `utils/screenTitles` restaurant initials.
Open #963 explicitly left Team Settings directory labels alone.

## Change

- `services/domain/presentationTeamDirectoryLabelIdentity.ts` — ASCII end trim
  only; soft-null on Unicode padding / controls / non-string; prefer
  canonical name then canonical email for the primary label; soft-null email
  subtitle separately; leave `|| t("team.member.unnamed")` and
  `|| t("team.member.emailMissing")` to the call site.
- `app/settings/team.tsx` — route directory member name and email labels
  through `presentationTeamDirectoryMemberLabel` /
  `presentationTeamDirectoryEmailLabel`.
- Tests: `tests/presentationTeamDirectoryLabelAsciiC.test.ts` (3/3).
- Left Create Task assignee chip labels (#963) and Settings account email
  label `.trim()` display on their own tips.

## Verification

- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- focused Team Settings directory ASCII C tests: 3/3
- `npm test`: 686 total / 686 pass / 0 fail / 0 cancelled; tip +3 vs main ~683
- Docker pgTAP unavailable in this environment

## Do not

- Share module with #964 / #963 / #962 / #961 / #960 / #849 / #674 / #435
- Re-tip this Team Settings directory label field
- Tip Settings account email label or Create Task assignee labels as covered
  by this tip
