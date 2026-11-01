# MISE-005VS tasks.shared.evidence ASCII C (2026-11-01)

## Defect

Task detail completed-evidence rows used:

```ts
entry.note ?? entry.label ?? entry.type ?? t("tasks.shared.evidence")
```

Unicode-only-space and empty string are non-nullish under `??`, bypassing
localized `tasks.shared.evidence` copy (and skipping later candidates when an
earlier field alone is padded). Unicode `.trim()` on padded evidence notes
would invent clean evidence bodies.

## Fix

- `services/domain/presentationTasksSharedEvidenceIdentity.ts`
- Soft-null via `normalizeTasksSharedEvidence` (ASCII C multiline: NBSP fold +
  C-end trim; preserve LF/TAB/CR; refuse em-space padding / disallowed
  controls) before `|| t("tasks.shared.evidence")` on `entry.note` then
  `entry.label` then `entry.type` in `app/tasks/[id].tsx` (1 site)

## Ownership

Owns only Task detail completionEvidence note/label/type →
`tasks.shared.evidence` presentation. Does **not** own write-path completion
evidence notes (#883), Task detail instructions →
`tasks.shared.noInstructions` (#1025), checklist label/type →
`tasks.shared.checklistItem` (#1026), domain create/hydrate detail (#823),
completionResult (#824), Create Task UI body/detail pass-through, or the
completion write-path English `"Completed checklist item"` hardcode.
Alone-OK relative to #1026/#1025/#883/#823/#824.

## Verification

- Focused tip tests in `tests/tasksSharedEvidenceAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test` (inherited `recalculationCycles` cancellations noted when present)
