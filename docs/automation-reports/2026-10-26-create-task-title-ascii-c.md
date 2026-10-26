# MISE-005QT Create Task title ASCII C (2026-10-26)

Tip: `cursor/mise-create-task-title-ascii-c`.

## Inventing proof

`app/more/create-task.tsx` `save()` Unicode-trimmed the draft title and passed
the trimmed result into both create payloads
(`'\u2003Count walk-in\u2003'.trim() === 'Count walk-in'`).

Soft empty / Unicode-only space softs to `null` (prior title-required error).
Em-space-padded non-empty keeps padding (no inventing equality).
NBSP folds then C whitespace collapses to ordinary ASCII spaces.

Open #822 owns restaurant-tasks domain title ASCII C.
Open #838 owns floor-notes / operator-task application title ASCII C.
Neither owns this Create Task screen gate that invents before either create
path receives the title.

## Change

- `services/domain/createTaskTitleIdentity.ts` — NBSP fold + C whitespace
  collapse + ASCII space trim
- Wire Create Task `save()` through `normalizeCreateTaskTitle`
- Leave due-date `.trim()`, checklist line `.trim()`, body free-text, and
  open #822 / #838 alone

## Merge notes

Alone-OK with #822 / #838. Keep module separate from
`restaurantTasksTitleIdentity.ts` and `floorNotesTitleIdentity.ts`. When
landing with #838, drop this tip's assertion that
`normalizeOperatorTaskTitle` still Unicode-trims once #838 owns that helper.

## Next tip preference

Prefer land/rebase of open stacks #348–#880 when merge capacity exists.
Next inventing candidates (verify live on main first): create-task
`dueDateText.trim()` ISO gate if still inventing; other remaining
Unicode-trim+use-result paths not already tipped through #880. Do not retip
#880/#879/#878/#877/#876/#875/#874/#873/#872/#871/#870/#869/#868/#867/#866/#822/#838.
