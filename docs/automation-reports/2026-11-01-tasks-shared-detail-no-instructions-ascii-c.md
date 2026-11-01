# MISE-005VQ: tasks.shared.noInstructions display ASCII C

Date: 2026-11-01  
Branch: `cursor/mise-tasks-shared-detail-no-instructions-ascii-c`

## Problem

Task detail rendered shared-task instructions with nullish coalescing before
the intentional localized fallback:

```ts
sharedTask.detail ?? t("tasks.shared.noInstructions")
```

A Unicode-only-space detail (`"\u2003"`) is non-nullish under `??`, so the
intentional `tasks.shared.noInstructions` copy was bypassed and task chrome
could show a blank-looking instructions body. Empty string has the same `??`
bypass. Separately, Unicode `.trim()` on padded detail would invent a clean
display body
(`"\u2003Count the walk-in case.\u2003".trim() === "Count the walk-in case."`).

## Change

- Add `services/domain/presentationTasksSharedDetailNoInstructionsIdentity.ts`
  with ASCII C multiline free-text prep (NBSP fold + C-end trim only; preserve
  internal LF/TAB/CR; refuse em-space padding and disallowed controls).
- Route the instructions display branch in `app/tasks/[id].tsx` through soft
  `normalizeTasksSharedDetailNoInstructions` so unsafe tokens fall through to
  the intentional localized fallback.
- Leave domain create/hydrate detail (#823), completion evidence notes (#883),
  checklist label/type fallbacks, completionResult (#824), and Create Task UI
  body/detail pass-through alone.

## Inventing / bypass proof

- `("\u2003" ?? FALLBACK) === "\u2003"` and `("" ?? FALLBACK) === ""`
  (nullish-coalescing fallback bypass).
- `"\u2003Count the walk-in case.\u2003".trim() === "Count the walk-in case."`
  (Unicode-trim inventing).
- ASCII C soft-null restores `|| t("tasks.shared.noInstructions")`.

## Verification

- Focused `tests/tasksSharedDetailNoInstructionsAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `npm run security:backend`
- `npm test` (expect inherited recalculationCycles cancellations only)
