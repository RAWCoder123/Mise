# MISE-005QW shared-task completion evidence note ASCII C (2026-10-26)

Tip: `cursor/mise-task-completion-evidence-note-ascii-c`

## Inventing proof

`app/tasks/[id].tsx` `completeSharedTask()` Unicode-trimmed the operator
evidence note before the required-evidence emptiness check and the
`completeSharedRestaurantTask` completionEvidence `note` payload
(`'\u2003Counted walk-in\u2003'.trim() === 'Counted walk-in'`,
`'\u00a0Counted walk-in\u00a0'.trim() === 'Counted walk-in'`), so NBSP /
em-space padding invented equality with a clean free-text evidence note.

Soft empty / Unicode-only space softs to omit (prior `.trim()` emptiness →
required-evidence error / omit optional note). Em-space padding is preserved
as typed rather than inventing equality with a clean note. NBSP folds to a
plain space under the ASCII C multiline free-text contract.

Open #824 owns restaurant-tasks domain `completionResult` ASCII C and
intentionally left the shared-task detail UI `completionResult.trim()`
emptiness gate alone.
Open #856 owns restaurant-tasks evidence `type` ASCII C and intentionally
left label emptiness / this UI evidence-note path alone.

## Change

- `services/domain/taskCompletionEvidenceNoteIdentity.ts` — ASCII C
  multiline free-text prep + soft normalize for completion evidence notes
- Wire shared-task detail `completeSharedTask()` through
  `normalizeTaskCompletionEvidenceNote`
- Leave `completionResult.trim()` emptiness (#824), domain
  `boundedEvidence` type/label prep (#856), Create Task checklist (#882),
  and assignee display trim alone

## Merge notes

Alone-OK with #824 / #856 / #882 / #823. Keep module separate. When landing
with #824, drop this tip's assertion that `completionResult.trim()` still
Unicode-trims for emptiness once #824 also owns the UI gate (if it does).
When landing with #856, drop this tip's assertion that
`boundedEvidence` still Unicode-trims `record.type` / label emptiness once
#856 owns those helpers.

## Next tip preference

Prefer land/rebase of open stacks #348–#882 when merge capacity exists.
Next inventing candidates (verify live on main first): remaining
Unicode-trim+use-result paths not already tipped through #882 / #883 —
prefer paths that Unicode-trim **and use the trimmed result**. Do not retip
#882/#881/#880/#879/#878/#877/#876/#875/#874/#873/#872/#871/#870/#869/#868/#867/#866
or this evidence-note tip. Create Task body free-text remains pass-through at
the UI and is owned downstream by open #823 / #839 — do not tip the UI body
path as inventing. Assignee display
`member.name?.trim() || member.email?.trim()` is presentation-only.

## Verification

focused AsciiC 4/4; typecheck; security static/backend; npm test (see PR).
Docker pgTAP unavailable in this environment.
