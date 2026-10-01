# Floor-note create entry (2026-09-01)

## Problem
Device-local floor notes could be listed and completed on Today, and Create Task
personal scope could create the same storage records, but operators had no
dedicated create surface for the existing `floorNotes.create.*` copy. The Today
section also hid entirely when empty, so create was undiscoverable. Completion
was incorrectly gated to managers even though notes are personal device tasks.

## Changes
- Add `app/more/create-floor-note.tsx` using `createFloorNote` and existing
  localized create copy (title, note, timing, focus).
- Register `/more/create-floor-note` in the root stack.
- Always surface the Today “Your tasks” section when the hub is ready, with Add
  CTA + empty state routing to the create screen.
- Allow any active restaurant member to complete device floor notes (aligned
  with Create Task personal scope).
- Pin UI contracts in `tests/floorNoteCreateUi.test.ts` and update
  `tests/pilotUiSafety.test.ts`.

## Verification
- `npm run typecheck`
- Focused floor-note / pilot UI tests
- `npm test`

## Notes
Does not change shared restaurant tasks, migrations, or Create Task. Device
storage remains local (`mise.operator-tasks.v1`).
