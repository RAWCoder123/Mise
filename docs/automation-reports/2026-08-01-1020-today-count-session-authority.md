# Today stock-risk tasks prefer count sessions (2026-08-01)

## Problem

Today emitted both a begin/continue inventory count session task and per-item
`update_inventory_count` shortcuts for the same stock-risk set. Operators could
"Resolve stock risk" on a single item and bypass submit → approve → ledger
adjustment, leaving session state and station balances inconsistent.

## Change

- `deriveOperationalTodayTasks` suppresses per-item inventory outlook tasks when
  an open count session exists or when stock-risk outlooks would create a
  begin-count session task.
- Unit coverage asserts open sessions and suggested begin-count paths no longer
  emit `update_inventory_count` shortcuts.

## Verification

- `npm test` (todayTasks + full suite) in this cycle when the environment allows.
