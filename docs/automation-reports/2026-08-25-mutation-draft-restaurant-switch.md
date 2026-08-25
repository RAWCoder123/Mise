# Mutation draft restaurant-switch isolation (2026-08-25)

Branch: `cursor/mise-mutation-draft-restaurant-switch`
Base: `origin/main` @ `6eedbfb`

## Gap

Several mutation surfaces cleared loaded restaurant data on switch but left
in-progress form drafts visible. An operator typing a task, Ask Mise question,
memory correction, or account-deletion confirmation for restaurant A could
submit or continue that draft after switching to restaurant B.

Sales CSV import draft clearing remains on open PR #153 and is not duplicated
here.

## Closed

- Create task: clear title/body/checklist/assignee/dependency and related form
  defaults on `restaurant?.id` change.
- Ask Mise: clear pending `input` on restaurant switch (messages already reset).
- Restaurant memory: clear `correctionDrafts` and busy id on switch.
- Settings: close delete-confirm UI and clear confirmation text / deleting lock
  on switch.
- Source pins in `tests/clientTenantSafety.test.ts`.

## Paths

- `app/more/create-task.tsx`
- `app/ask-mise.tsx`
- `app/more/restaurant-memory.tsx`
- `app/(tabs)/settings.tsx`
- `tests/clientTenantSafety.test.ts`

## Do not redo

- Sales-import CSV draft clear (#153).
- Hub soft-refresh fail-closed (#150–#152).
- Pilot readiness UI (#145/#148/#149).
- #130–#135 scopes.
