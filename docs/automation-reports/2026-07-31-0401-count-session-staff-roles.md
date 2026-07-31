# Count session staff draft / manager approve (2026-07-31)

## Completed

- Fast-forwarded prior private-beta hardening from `cursor/mise-product-inspection-c507` onto this branch.
- Split inventory count session authorization:
  - Staff (and managers+) may begin, save progress, and submit multi-item count sessions.
  - Only owner/admin/manager may approve ledger adjustments or cancel an open session.
- Enforced the split in:
  - Domain helpers (`canDraftInventoryCountSession` / `canApproveInventoryCountSession`)
  - Tenant access helpers used by UI
  - Edge `operational-workflows` role gate (`staffCountDraftActions`)
  - SQL migration `20260731040129_count_session_staff_draft_roles.sql`
  - `/inventory/count` and Inventory list entry points
  - Today tasks: in-progress → `member`; submitted → `manager`
- Localized staff awaiting-approval copy (EN/ES/zh-Hans).

## Verification

- Unit/domain coverage for role helpers and Today task visibility.
- Static security contract coverage for staff draft migration + Edge allowlist.
- `npm run typecheck`, `npm test`, `npm run security:backend`, `npm run design:static` (run in this workspace).
- Docker/hosted RLS re-proof still required for the July 30–31 migration chain.
