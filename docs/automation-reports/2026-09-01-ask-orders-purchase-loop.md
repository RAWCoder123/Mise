# Ask Mise orders grounded in purchase-loop follow-through (2026-09-01)

Tip: `cursor/mise-ask-orders-purchase-loop-tasks`
Base: `origin/main` @ `20b28e5`

## Problem

Ask Mise `orders` answers treated `pendingRecommendations === 0` as “orders clear,”
even when Today still projected open `prepare_supplier_draft` or `send_supplier_order`
tasks. Pilots could hear that Sent/History were fine while approved drafts still needed
operator send.

## Fix

- Recognize open purchase-loop intents (`review_recommendation`, `prepare_supplier_draft`,
  `send_supplier_order`) and draft/send follow-through specifically
- Refuse `ordersClear` when any purchase-loop task remains
- Name follow-through tasks and surface them as Ask priority chips
- Keep Review answers when recommendations are pending; append named draft/send next steps
- Thinking steps use follow-through evidence instead of a false clear
- EN / ES / zh-Hans catalog coverage

## Paths

- `services/ai/askMise.ts`
- `i18n/catalog.ts`
- `tests/askMise.test.ts`
- `docs/automation-reports/2026-09-01-ask-orders-purchase-loop.md`

## Verification

- `npm run typecheck`
- focused `tests/askMise.test.ts`
- `npm test`
- no migration
