# Today role-aware tasks + staff begin-count (2026-07-31)

## Problem
1. Staff can begin and draft multi-item inventory counts, but Today only surfaced count work after a session already existed.
2. Stock-risk and supplier tasks still listed manager-only work first, so the compact Today board crowded staff with locked rows.

## Change
- When stock-risk items exist and no open count session is present, derive a `begin_inventory_count_session` Today task (`member` role) routed to `/inventory/count`.
- Added presentation code `today.inventory_count_session.begin` with EN/ES/zh-Hans titles, details, and action labels.
- Added `prioritizeOperationalTodayTasksForRole` so actionable tasks stay ahead of locked manager/owner follow-ups while preserving urgency order inside each group.
- Today task section uses role-aware ordering and a clearer subtitle when both actionable and restricted work are present.
- Count-session rows use the clipboard icon instead of the insight fallback.

## Verification
- `tests/todayTasks.test.ts` covers begin-count generation, suppression when a session is open, and staff-first prioritization.
- `tests/operationsPresentation.test.ts` covers the new intent/presentation code across locales.
- `npm run typecheck`, `npm test` (218), `npm run security:backend`, `npm run design:static`.

## Classification impact
Still controlled pilot / private-beta oriented: staff can discover their count workflow from Today. Transfers, Auth email invites, Docker/hosted re-proof, and App Store legal URLs remain open.
