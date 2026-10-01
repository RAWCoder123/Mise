# MISE-005ES restaurant_tasks.completion_result cntrl locale pin

Date: 2026-10-01
Branch: `cursor/mise-restaurant-tasks-completion-result-cntrl-locale-pin`
Base: `origin/main` @ `78da737`

## Change

- Additive migration `20261001230000_mise_005es_restaurant_tasks_completion_result_cntrl_locale_pin.sql`
- Add `restaurant_tasks_completion_result_bound_check`
- Preserve exact `length(trim(completion_result)) between 1 and 1000` when not null
- Add multiline-aware ASCII control rejection under COLLATE `"C"`:
  `completion_result collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'`
  (allows LF/TAB/CR; rejects other C0 controls and DEL)
- Domain `requiredTaskCompletionResult` / `optionalTaskCompletionResult` reject the
  same unsafe control set on complete/read normalize paths without collapsing
  multiline whitespace

## Scope boundaries

CHECK-only SQL. Does not rewrite `restaurant_tasks_completion_check`, task RPCs,
title (#556), detail (#554), failure_reason (#555), delivery notes (#553),
count notes (#552), operator_note (#551), or insight body (#550).

## Why multiline-aware

The complete-task UI (`app/tasks/[id].tsx`) uses a multiline TextInput for the
completion result. Full `[[:cntrl:]]` would reject LF.

## Verification

- `npm run typecheck`
- focused `restaurantTasksCompletionResultCntrlLocalePin`
- `npm test`
- pgTAP plan counted from assertion call sites in source
