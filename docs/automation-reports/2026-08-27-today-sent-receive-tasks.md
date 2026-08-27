# Today sent-order receive tasks (2026-08-27)

## Problem

Today treated `supplier_orders.status = sent` as a completed send task and dropped
it from the open queue. Operators lost the delivery follow-through cue even though
receiving is a distinct, incomplete workflow until status becomes `completed`.

## Change

- Keep the existing send task ID stable: draft → open send; sent/completed → completed send.
- Project a separate `receive_supplier_order` task when status is `sent` or `completed`.
- Receive remains open for `sent`, completes only for `completed`.
- Operating plan depends receive → send, verifies with `receipt`, and localizes EN/ES/ZH.

## Paths

- `services/domain/todayTasks.ts`
- `services/domain/operatingPlan.ts`
- `services/presentation/operationsPresentation.ts`
- `types/presentation.ts`
- `components/operations/OperatingPlanTimeline.tsx`
- `app/tasks/[id].tsx`
- `i18n/catalog.ts`
- `tests/todayTasks.test.ts`
- `tests/operatingPlan.test.ts`
- `tests/operationsPresentation.test.ts`

## Verification

- `npm run typecheck`
- `npm test` (targeted + suite)

## Not claimed

- Hosted receive-line integrity (owned by open PRs #196–#198)
- Automatic push notifications for overdue receives
