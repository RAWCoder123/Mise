# MISE-005YT: pin Create Task list display task.title to ASCII C

Date: 2026-11-07  
Branch: `cursor/mise-create-task-list-display-title-ascii-c`  
Base: `origin/main` @ `78da7376`

## Closed

Create Task list-row display `task.title` inventing / blank-body bypass via prior always-pass:

```tsx
<Text style={styles.taskTitle}>{task.title}</Text>
```

Soft-null empty / Unicode-padded / unsafe titles → localized `operatorTasks.list.title.none` (EN / ES / zh-Hans). Alone-OK beside #1072 / #880 / #822 / #1071 / #1049 / #1151 (no migration). Distinct from Create Task list-row a11y tip (#1072 / MISE-005XL) and Create Task form save-path title tip (#880 / MISE-005QT).

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered as the taskTitle Text with no localized none fallback
- `"\u2003Count walk-in\u2003".trim() === "Count walk-in"` inventing equality
- ASCII C soft-null restores `operatorTasks.list.title.none`

## Leave alone

- Create Task list-row a11y task.title (#1072 / MISE-005XL)
- ChoiceRow dependency `label={task.title}`
- Create Task form save-path title (#880 / MISE-005QT)
- restaurant-tasks domain title (#822)
- Activity expand a11y event.title (#1071)
- Home ApprovalsSection card.title (#1049)
- Home ActivityRow event.summary display (#1151)

## Alone-OK

No migration. Beside #1072 / #880 / #822 / #1071 / #1049 / #1151. Ordinary UI conflicts possible with Create Task inventing stacks.

## Verification

- Focused `createTaskListDisplayTitleAsciiC` 5/5 (58 assertion call sites; plan from source)
- `npm run typecheck` passed
- `npm run security:static` / `security:backend` passed
- `npm run design:static` passed
- `npm test`: see PR / commit notes (includes MISE-005YT tip tests; inherited recalculationCycles cancellations)

No migration. Docker pgTAP not run in this environment.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
