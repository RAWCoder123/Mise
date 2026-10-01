# Ask Mise prep grounded in Today count tasks

Date: 2026-09-01  
Branch: `cursor/mise-product-inspection-b3a8`  
Base: `origin/main` @ `20b28e5`

## Problem

Ask Mise prep answers only looked at prep/sales insights. With an empty insight list, the reply claimed prep was clear even when Today still had open inventory count or low-stock count tasks.

## Fix

- Treat open `begin_inventory_count_session`, `continue_inventory_count_session`, and `update_inventory_count` Today tasks as prep-blocking evidence.
- Also treat open prep/sales insight-review tasks as prep-blocking.
- Surface those task titles before (or instead of) insight-only prep copy; never emit `ask.answer.prep.clear` while they remain open.
- Prefer prep-blocking tasks as Ask Mise priority chips so presses keep authoritative `action.route`.
- Add EN/ES/zh-Hans thinking and answer keys for count-task grounding.

## Paths

- `services/ai/askMise.ts`
- `i18n/catalog.ts`
- `tests/askMise.test.ts`
- `docs/automation-reports/2026-09-01-ask-prep-today-count-tasks.md`

## Verification

- `npm run typecheck`
- Focused Ask Mise tests
- `npm test`
