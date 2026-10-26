# MISE-005QV Create Task checklist ASCII C

Tip branch: `cursor/mise-create-task-checklist-ascii-c`

## Inventing proof

`app/more/create-task.tsx` `save()` Unicode-trimmed each restaurant-scope
checklist line before `filter(Boolean)` and the
`createSharedRestaurantTask` checklist payload
(`'\u2003Check walk-in\u2003'.trim() === 'Check walk-in'`).

Soft empty / Unicode-only space softs to omit (prior `.trim()` +
`filter(Boolean)`). Em-space padding is preserved as typed rather than
inventing equality with a clean checklist label. NBSP folds to a plain
space under the ASCII C display-prep contract.

Open #880 owns Create Task title ASCII C and intentionally left checklist
line `.trim()` alone. Open #881 owns Create Task personal due-date ASCII C
and intentionally left checklist line `.trim()` alone.

## Change

- `services/domain/createTaskChecklistIdentity.ts` — ASCII C display prep +
  soft normalize for checklist lines / draft
- Wire Create Task restaurant-scope `save()` checklist through
  `normalizeCreateTaskChecklist`
- Leave title `.trim()` (#880), due-date `.trim()` (#881), body free-text,
  and assignee display trim alone

## Merge notes

Alone-OK with #880 / #881 / #822 / #838. Keep module separate. When landing
with #880, drop #880's assertion that checklist `.map((line) => line.trim())`
still Unicode-trims in `save()`, and drop this tip's assertion that
`title.trim()` still Unicode-trims once #880 owns that helper. When landing
with #881, drop this tip's assertion that `dueDateText.trim()` still
Unicode-trims once #881 owns that helper.

## Verification

focused AsciiC; typecheck; security static/backend; npm test.
