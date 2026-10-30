# MISE-005UG Login email chip label ASCII C (2026-10-30)

- Branch: `cursor/mise-login-email-chip-label-ascii-c`
- Base: `origin/main` @ `78da737`

## Inventing proof

Login password-step chrome used `{email.trim()}` for the editable email chip.
Unicode `.trim()` stripped em-space / NBSP padding before rendering, so
`'\u2003chef@example.com\u2003'.trim()` invented a clean login email chip
label.

Not owned by open #970 (Insights profile cuisine-type), #969 (Insights
profile restaurant-name), #968 (Today screen title restaurant-name), #967
(restaurant branding initials), #966 (Settings account email labels), #965
(Team Settings directory labels), #964 (More/Settings profile name labels),
#963 (Create Task assignee chip labels), #962 (More/Settings profile
initials), #961 (Home/Ask Mise greeting firstName), #960 (outreach greeting
firstName), #959 (outreach-webhook From mailbox), #849 (user profile display
name), `normalizeTeamMemberEmail` (#674 / #435), or `normalizeOutreachEmail`
(#420). Auth continue / sign-in emptiness gates that still use `email.trim()`
for credential submission are left alone.

## Change

- `services/domain/presentationLoginEmailChipLabelIdentity.ts` — ASCII end
  trim only; soft-null on Unicode padding / controls / non-string; call site
  falls back to the raw typed seed without inventing clean chrome.
- `app/(auth)/login.tsx` — route password-step email chip through
  `presentationLoginEmailChipLabel(email) || email`.
- Tests: `tests/presentationLoginEmailChipLabelAsciiC.test.ts` (3/3).
- Left auth continue / sign-in `email.trim()` gates and Settings account email
  label `.trim()` display alone.

## Verification

- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- focused Login email chip label ASCII C tests: 3/3
- `npm test`: 686 total / 686 pass / 0 fail / 0 cancelled; tip +3 vs main ~683
- Docker pgTAP unavailable in this environment

## Do not

- Share module with #970 / #969 / #968 / #967 / #966 / #965 / #964 / #963 /
  #962 / #961 / #960 / #959 / #849 / #420 / #674
- Re-tip this Login email chip label field
- Tip Settings account email labels, auth continue / sign-in emptiness gates,
  outreach-webhook From mailbox, or Team / Create Task / greeting identity as
  covered by this tip
