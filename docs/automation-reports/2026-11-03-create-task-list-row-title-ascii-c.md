# MISE-005XL Create Task list-row a11y task.title ASCII C

Date: 2026-11-03

## Gap

Create Task always passed raw `task.title` into
`t("operatorTasks.list.rowAccessibility", { title: task.title })` for both
restaurant-shared and personal list rows. Empty / Unicode-only-space titles are
non-nullish (and Unicode-only-space is truthy), so VoiceOver / TalkBack labels
could include blank-looking task identity with no intentional localized none
marker. Unicode `.trim()` on padded titles would invent a clean task label.

## Change

- Add `normalizeCreateTaskListRowTitle` (ASCII end trim; soft-null Unicode
  padding / controls; preserve NBSP — no fold)
- Route both list-row a11y `title` interpolations through soft-null before
  `|| t("operatorTasks.list.rowTitle.none")`
- Add EN / ES / zh-Hans `operatorTasks.list.rowTitle.none`
- Focused inventing / bypass proofs in
  `tests/createTaskListRowTitleAsciiC.test.ts`

## Ownership

Owns only Create Task list-row a11y **title → operatorTasks.list.rowTitle.none**.
Leaves Create Task list display Text `{task.title}`, dependency ChoiceRow
`label={task.title}`, Create Task form save-path title (#880), Activity expand
a11y event.title (#1071), and Home ApprovalsSection card.title (#1049) alone.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
