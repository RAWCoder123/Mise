# MISE-005ZW: pin Create Task list display task.detail / task.body to ASCII C

Date: 2026-11-08  
Branch: `cursor/mise-create-task-list-display-body-ascii-c`  
Base: `origin/main` @ `78da7376`

## Closed

Create Task list-row display `task.detail` (restaurant scope) and `task.body`
(personal scope) inventing / blank-body bypass via prior truthy-gated
always-pass:

```tsx
{task.detail ? <Text numberOfLines={3} style={styles.taskBody}>{task.detail}</Text> : null}
{task.body ? (
  <Text numberOfLines={3} style={styles.taskBody}>
    {task.body}
  </Text>
) : null}
```

Soft-null empty / Unicode-padded / unsafe bodies → localized
`operatorTasks.list.body.none` (EN Note / ES Nota / zh-Hans 说明) when the raw
field is present. Null / empty raw body still omits the Text. Alone-OK beside
#1152 / #1153 / #1072 / #880 / #1159 / #1160 / #1165 / #1155 (no migration).
Distinct from Create Task list display title tip (#1152 / MISE-005YT).

## Inventing / bypass proof

- Free-form operator body → restaurant `optionalText(row.detail)` Unicode
  `.trim()` and personal `normalizeOperatorTaskBody` Unicode-aware `\s`
  end-trim invent clean body identity
- `Boolean("\u2003") === true` previously still rendered as the taskBody Text
  with no localized none fallback
- `"\u2003Check walk-in cooler before open\u2003".trim() === "Check walk-in cooler before open"`
  inventing equality
- ASCII C soft-null restores `operatorTasks.list.body.none`

## Leave alone

- Create Task list display task.title (#1152 / MISE-005YT)
- Create Task list-row a11y task.title (#1072 / MISE-005XL)
- ChoiceRow dependency `label={task.title}` (#1153 / MISE-005YU)
- Create Task form save-path title (#880 / MISE-005QT) and body normalize paths
- Task detail sharedTask.title / operational presentation.title / .detail
  (#1159 / #1160 / #1165)
- Activity expanded evidence.summary (#1155 / MISE-005YW)

## Alone-OK

No migration. Beside #1152 / #1153 / #1072 / #880 / #1159 / #1160 / #1165 /
#1155. Ordinary UI conflicts possible with Create Task inventing stacks on
`app/more/create-task.tsx` / `i18n/catalog.ts`.

## Verification

- Focused `createTaskListDisplayBodyAsciiC` 5/5 (68 assertion call sites; plan from source)
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm run design:static`
- `npm test`

No migration. Docker pgTAP not run in this environment.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
