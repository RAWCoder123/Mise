# MISE-005ZA: pin Task detail sharedTask.title display to ASCII C

Date: 2026-11-07  
Branch: `cursor/mise-task-detail-shared-title-ascii-c`  
Base: `origin/main` @ `78da7376`

## Closed

Task detail hero `sharedTask.title` inventing / blank-body bypass via prior always-pass:

```tsx
<Text style={styles.title}>{sharedTask.title}</Text>
```

Soft-null empty / Unicode-padded / unsafe titles → localized `tasks.shared.title.none` (EN / ES / zh-Hans). Alone-OK beside #1152 / #1153 / #1072 / #880 / #822 (no migration). Distinct from Create Task list display (#1152 / MISE-005YT), Create Task ChoiceRow (#1153 / MISE-005YU), and restaurant-tasks domain title writer (#822 / MISE-005ON).

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered as the hero title Text with no localized none fallback
- `"\u2003Count walk-in\u2003".trim() === "Count walk-in"` inventing equality
- ASCII C soft-null restores `tasks.shared.title.none`

## Leave alone

- Create Task list display task.title (#1152 / MISE-005YT)
- Create Task dependency ChoiceRow task.title (#1153 / MISE-005YU)
- Create Task list-row a11y task.title (#1072 / MISE-005XL)
- Create Task form save-path title (#880 / MISE-005QT)
- restaurant-tasks domain title (#822 / MISE-005ON)
- Task detail operational `presentation.title`
- Task detail `sharedTask.detail` / completionResult surfaces
- Activity / Home inventing stack (#1148–#1158)

## Alone-OK

No migration. Beside #1152 / #1153 / #1072 / #880 / #822. Ordinary UI conflicts possible with other Task detail inventing stacks on `app/tasks/[id].tsx`.

## Verification

- Focused `taskDetailSharedTitleAsciiC` 5/5 (63 assertion call sites; plan from source)
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm run design:static`
- `npm test` (see PR / commit notes; inherited recalculationCycles cancellations)

No migration. Docker pgTAP not run in this environment.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
