# Create Task assignee ranked search (2026-08-29)

## Gap

More → Create Task listed every assignable teammate with no find control once
the eligible team grew past a short list.

## Fix

- Domain: `services/domain/restaurantTaskAssigneeSearch.ts` —
  `filterRestaurantTaskAssigneesBySearch` + threshold 8; name/email/role ranking;
  user-id dedupe; blank-label skip.
- UI: `app/more/create-task.tsx` — search when assignable members >8; showing
  X of Y + empty copy; query resets on restaurant or required-role change.
- EN/ES/zh-Hans `operatorTasks.assignee.search.*`.
- Unit + UI static pin in `tests/restaurantTaskAssigneeSearch.test.ts`.
