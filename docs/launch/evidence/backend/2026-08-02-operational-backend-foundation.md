# Operational backend foundation evidence

Date: 2026-08-02  
Batch: `operational-backend-foundation-40`  
Scope: master-prompt Milestones 1–3 foundation plus correctable memory and safe autonomy controls

## Delivered

- Nine additive tenant-scoped operational tables: issues, activity, actions,
  outcomes, memories, autonomy rules, supplier confirmations, deliveries, and
  delivery items.
- Membership RLS, explicit table privileges, append-only truth guards,
  authenticated operational-mode enforcement, role-gated RPCs, and service-only
  wrappers for backend activity, supplier confirmation, and failed/unverified sends.
- Truthful one-time backfill for existing open recommendations and persisted
  supplier orders.
- Operating-brief Home with deterministic status, confidence/freshness,
  approvals, recent/since-away activity, monitoring, and routed actions.
- Inventory coverage/status consistency with a regression guard against a
  `Good` item carrying a today/tomorrow stockout warning.
- Approval-gated supplier send with explicit failed versus unverified outcomes
  and no automatic retry of ambiguous provider results.
- Replay-safe delivery receiving that records inventory receipt events, action
  outcomes, activity, and bounded supplier-reliability memory.
- Owner-visible Activity History, Restaurant Memory, Autonomy, and nine-table
  restaurant export parity in hosted and demo modes.

## Automated evidence

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 391/391 passed |
| `npm audit --audit-level=high` | 0 vulnerabilities |
| `npm run doctor` | 21/21 checks passed |
| `npm run security:backend` | Passed |
| `npm run design:static` | Passed |
| Deno format/typecheck for changed Edge Functions | Passed |
| Expo web export | Passed |
| `npm run qa:routes` | All declared routes returned HTTP 200 |
| `npm run qa:interactions` | Full workflow plus English, Spanish, Simplified Chinese at 390×844; zero horizontal overflow |
| `npm run supabase:test` | 14 files, 621 pgTAP assertions passed |
| Workspace concurrency proof | 5 accepted, 15 rejected, 5 immutable allocations |
| Local Supabase security advisor | No issues found |

## Rendered Browser evidence

The in-app Browser verified `/home`, `/today`, `/inventory`, `/orders`,
`/insights`, `/setup`, `/settings`, `/more/activity`,
`/more/restaurant-memory`, and `/settings/autonomy` at 390×844.

- Page identity/title: passed
- Meaningful content / not blank: passed after application hydration
- Framework overlay: none
- Horizontal overflow: none on every route
- Console: no application errors after the SVG transform fix; the only warning
  is the expected local-demo disclosure that Supabase public env vars are absent
- Interaction: Insights Daily Brief → Sales updated the visible view and chart
- Screenshots: stored outside the repository under the Codex visualization
  workspace for this task

The rendered pass found and fixed a web-only `transform-origin` warning from the
donut SVG. A standards-compliant SVG rotate transform now renders without the
developer warning toast.

## Security conclusions

- External order delivery cannot bypass action approval.
- Rejected/cancelled/reversed actions cannot send.
- Ambiguous provider results become `unverified` and block automatic retries.
- Expo has no provider secret or OpenAI-key authority.
- New tables are tenant scoped and unavailable to anonymous clients.
- Service privileges are explicit and omit `TRUNCATE`.
- Demo data remains local, replaceable, labeled, and cannot leak into production calculations.

## Remaining release evidence

No P0/P1 foundation issue remains. Staging deployment, live provider receipts,
scheduled operational cycles, physical-iPhone proof, managed recovery, and
external release approvals require separate batches and external authority.
No checkpoint commit was created because the shared worktree contains broader
user-owned changes.
