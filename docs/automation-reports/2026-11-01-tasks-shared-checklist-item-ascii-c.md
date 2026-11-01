# MISE-005VR: tasks.shared.checklistItem display ASCII C

Date: 2026-11-01  
Branch: `cursor/mise-tasks-shared-checklist-item-ascii-c`

## Problem

Task detail rendered shared-task checklist rows with nullish coalescing before
the intentional localized fallback:

```ts
entry.label ?? entry.type ?? t("tasks.shared.checklistItem", { number: index + 1 })
```

A Unicode-only-space label (`"\u2003"`) is non-nullish under `??`, so the
intentional `tasks.shared.checklistItem` copy was bypassed and the type
candidate was never consulted. Empty string has the same `??` bypass. The same
bypass applies when `label` is absent and `type` alone is Unicode-only space or
empty. Separately, Unicode `.trim()` on padded checklist labels would invent a
clean display label
(`"\u2003Walk-in count\u2003".trim() === "Walk-in count"`).

## Change

- Add `services/domain/presentationTasksSharedChecklistItemIdentity.ts` with
  ASCII C single-line prep (end trim only; preserve NBSP; full C0/DEL reject;
  refuse em-space / NBSP end padding).
- Route the checklist display branch in `app/tasks/[id].tsx` through soft
  `normalizeTasksSharedChecklistItem` on `label` then `type` so unsafe tokens
  fall through to the intentional localized fallback.
- Leave Task detail instructions → `tasks.shared.noInstructions` (#1025),
  evidence display `entry.note ?? … ?? tasks.shared.evidence`, completion
  write-path English `"Completed checklist item"`, domain create/hydrate
  detail (#823), completion evidence notes (#883), and completionResult
  (#824) alone.

## Inventing / bypass proof

- `("\u2003" ?? type ?? FALLBACK) === "\u2003"` and `("" ?? type ?? FALLBACK) === ""`
  (nullish-coalescing fallback / type-candidate bypass).
- `(undefined ?? "\u2003" ?? FALLBACK) === "\u2003"` (type-only bypass).
- `"\u2003Walk-in count\u2003".trim() === "Walk-in count"` (Unicode-trim inventing).
- ASCII C soft-null restores `|| t("tasks.shared.checklistItem", …)`.

## Verification

- Focused `tests/tasksSharedChecklistItemAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `npm run security:backend`
- `npm test` (expect inherited recalculationCycles cancellations only)
