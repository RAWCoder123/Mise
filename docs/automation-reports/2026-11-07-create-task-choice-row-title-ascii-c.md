# MISE-005YU: pin Create Task dependency ChoiceRow task.title to ASCII C

Date: 2026-11-07  
Branch: `cursor/mise-create-task-choice-row-title-ascii-c`  
Base: `origin/main` @ `78da7376`

## Closed

Create Task dependency ChoiceRow `task.title` inventing / blank-body bypass via prior always-pass:

```tsx
<ChoiceRow label={task.title} … />
```

Soft-null empty / Unicode-padded / unsafe titles → localized `operatorTasks.dependency.title.none` (EN / ES / zh-Hans). Alone-OK beside #1152 / #1072 / #880 / #822 / #1071 (no migration). Distinct from Create Task list display title tip (#1152 / MISE-005YT) and Create Task list-row a11y tip (#1072 / MISE-005XL).

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered as the ChoiceRow label Text with no localized none fallback
- `"\u2003Count walk-in\u2003".trim() === "Count walk-in"` inventing equality
- ASCII C soft-null restores `operatorTasks.dependency.title.none`

## Leave alone

- Create Task list display task.title (#1152 / MISE-005YT)
- Create Task list-row a11y task.title (#1072 / MISE-005XL)
- Create Task form save-path title (#880 / MISE-005QT)
- restaurant-tasks domain title (#822)
- assignee ChoiceRow `member.name?.trim()`
- Activity expand a11y event.title (#1071)

## Alone-OK

No migration. Beside #1152 / #1072 / #880 / #822 / #1071. Ordinary UI conflicts possible with Create Task inventing stacks (especially #1152 asserting raw `label={task.title}`).

## Verification

- Focused `createTaskChoiceRowTitleAsciiC` 5/5 (60 assertion call sites; plan from source)
- `npm run typecheck` passed
- `npm run security:static` / `security:backend` passed
- `npm run design:static` passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (pre-existing recalculationCycles hung-timeout cancellations; unrelated)

No migration. Docker pgTAP not run in this environment.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
