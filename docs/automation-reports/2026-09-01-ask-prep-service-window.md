# Ask Mise prep grounded in before-prep service windows

Date: 2026-09-01  
Branch: `cursor/mise-ask-prep-service-window`  
Base: `origin/main` @ `20b28e5`

## Problem

Shared restaurant tasks carry `serviceWindow` (including `before_prep`), and the operating plan already uses that window. `OperationalTodayTask` projections dropped the window, so Ask Mise prep answers could emit `ask.answer.prep.clear` while open before-prep shared tasks remained on Today.

## Fix

- Project `serviceWindow` from shared restaurant tasks onto `OperationalTodayTask`
- Ask Mise prep refuses clear when open `restaurant_task` rows have `serviceWindow === "before_prep"`
- Priority chips prefer those before-prep tasks
- Thinking steps distinguish prep-window task presence
- EN / ES / zh-Hans catalog keys for prep-task copy

## Paths

- `services/domain/todayTasks.ts`
- `services/domain/restaurantTasks.ts`
- `services/ai/askMise.ts`
- `i18n/catalog.ts`
- `tests/restaurantTasks.test.ts`
- `tests/askMise.test.ts`

## Verification

- `npm run typecheck`
- Focused `tests/askMise.test.ts` + `tests/restaurantTasks.test.ts`
- `npm test`

## Distinct from

- #319 Ask Mise prep Today count/prep-blocking tasks (count sessions / insight reviews)
- #316 Ask Mise stock count trust
