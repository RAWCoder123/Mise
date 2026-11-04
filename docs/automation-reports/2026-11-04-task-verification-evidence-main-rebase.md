# Task verification structured evidence — main rebase (2026-11-04)

## Gap

Shared restaurant tasks advertised `count` / `receipt` verification, but
completion only required a free-text note. Staff could mark a count or receipt
task complete without a live same-tenant inventory count session or completed
supplier order.

Open #221 (`cursor/mise-task-verification-evidence`) already implements the
fix but sat two commits behind `origin/main` (`MISE-004C`, `MISE-005A`).

## This tip

Cherry-pick `2ee740b9` onto `origin/main` @ `78da7376` as
`cursor/mise-task-verification-evidence-main-rebase`.

**Supersedes** open #221 for this workflow (rebased rather than duplicated).

## Behavior preserved

1. `count` verification evidence must include
   `{ type: "count_session", countSessionId }` for a live submitted or approved
   same-tenant inventory count session.
2. `receipt` verification evidence must include
   `{ type: "supplier_receipt", supplierOrderId }` for a completed supplier
   order (and must match `related_order_id` when set).
3. Domain, demo, and hosted `complete_restaurant_task` fail closed without that
   live evidence. Task detail UI links eligible sessions / receipts.
4. Additive migration
   `20260828030000_task_verification_structured_evidence.sql` still lands
   between the shared-tasks foundation and MISE-004C; no intervening
   `complete_restaurant_task` redefinition exists on main.

## Out of scope

- English write fallback `Completed checklist item` in `app/tasks/[id].tsx`
  (owned by open #268 / #1028)
- Checklist-only / photo / manager_review / source_state paths beyond existing
  typed evidence
- Close-cycle reconciliation (#192), receive discrepancy (#670), recipe unlink
  (#671)

## Verification

- `npm run typecheck`
- focused `tests/restaurantTasks.test.ts` +
  `tests/restaurantTasksRepository.test.ts` +
  `tests/sharedRestaurantTasksMigration.test.ts` (15/15)
- `npm test` (686 total / 679 pass / 0 fail / 7 cancelled — inherited
  recalculationCycles `withTimeout` flake)
- `npm run security:static` + `security:backend`

## Classification

Controlled pilot-ready product tip. Deploy the additive migration before hosted
tenants receive the fail-closed RPC behavior. Not App Store submission-ready.
