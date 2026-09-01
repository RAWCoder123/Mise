# Ask Mise priority chips prefer action routes

Date: 2026-09-01  
Branch: `cursor/mise-ask-task-action-route`  
Base: `origin/main` @ `20b28e5`

## Problem

Ask Mise priority chips always opened `/tasks/{id}` even when the projected
operational task already carried an authoritative workflow route (orders,
inventory count, POS, item detail, etc.). Home/Today presses are covered by a
separate open tip (#314); Ask Mise was explicitly left out of that scope.

## Change

- Priority row presses on `/ask-mise` use `task.action.route`.
- Unit coverage asserts returned priorities retain `action.route` and that the
  screen prefers that route over task-detail hardcoding.

## Paths

- `app/ask-mise.tsx`
- `tests/askMise.test.ts`
- `docs/automation-reports/2026-09-01-ask-task-action-route.md`

## Verification

- `npm run typecheck`
- `npm test` (askMise + related)

## Out of scope

- Landing/rebasing open stacks #147–#314
- Home/Today action-route presses (#314)
- Ask Mise stock truthfulness for non-authoritative counts
- Inventory purchase-unit correction
