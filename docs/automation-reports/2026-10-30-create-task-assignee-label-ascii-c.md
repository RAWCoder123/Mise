# MISE-005TY Create Task assignee chip label ASCII C (2026-10-30)

- Branch: `cursor/mise-create-task-assignee-label-ascii-c`
- Base: `origin/main` @ `78da737`

## Inventing proof

Create Task assignee ChoiceRow labels used
`member.name?.trim() || member.email?.trim() || t("operatorTasks.assignee.teammate")`.
Unicode `.trim()` stripped em-space / NBSP padding before rendering, so
`'\u2003Alex Rivera\u2003'.trim()` invented a clean assignee chip label, and a
padded email invented a clean email fallback when name was empty/padded.

Not owned by open #962 (More/Settings profile initials), #961 (Home/Ask Mise
greeting firstName), #960 (outreach greeting firstName), #849 (user profile
display name), #811 (restaurant-tasks `assigneeUserId`), More/Settings profile
**name** label `.trim()` display, or team member directory labels.

## Change

- `services/domain/presentationCreateTaskAssigneeLabelIdentity.ts` — ASCII end
  trim only; soft-null on Unicode padding / controls / non-string; prefer
  canonical name then canonical email; leave
  `|| t("operatorTasks.assignee.teammate")` to the call site.
- `app/more/create-task.tsx` — route assignee chip labels through
  `presentationCreateTaskAssigneeLabel`.
- Tests: `tests/presentationCreateTaskAssigneeLabelAsciiC.test.ts` (3/3).
- Left `app/settings/team.tsx` directory labels on their own tip.

## Verification

- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- focused Create Task assignee ASCII C tests: 3/3
- `npm test`: 686 total / 679 pass / 0 fail / 7 cancelled (inherited
  recalculationCycles `withTimeout`); tip +3 vs main ~683
- Docker pgTAP unavailable in this environment

## Do not

- Share module with #961 / #960 / #962 / #849 / #811
- Re-tip this Create Task assignee chip label field
- Tip team directory labels or More/Settings profile name label as covered
  by this tip
