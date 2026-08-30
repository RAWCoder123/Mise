# Return submitted inventory count sessions for revision

## Summary

Managers can return a **submitted** inventory count session to `in_progress` so staff can correct counted lines without discarding progress or writing the inventory ledger. Approve and cancel remain available; return does not invent on-hand quantities.

## Why

On main, submitted sessions were frozen until Approve (ledger write) or Cancel (destroys the session). A bad submit forced wrong ledger numbers or a full recount.

## Backend

- Migration `20260830170000_return_inventory_count_session.sql`
  - Manager+ `SECURITY DEFINER` RPC `service_return_inventory_count_session`
  - Requires `status = submitted`
  - Sets `in_progress`, clears `submitted_by` / `submitted_at`
  - Preserves all count lines and notes
  - Writes no `inventory_events`
  - `service_role` execute only
- Edge `operational-workflows` action `return_count_session` (manager+, not staff)
- Audit action `inventory_count_session_returned`

## App

- Domain: `assertSessionMutable(..., "return")`, `canReturnInventoryCountSession`
- Application / repos: `returnInventoryCountSession` (demo + Supabase)
- UI: `/inventory/count` — Return for revision confirm when submitted and manager+
- i18n: EN / ES / zh-Hans

## Verification

- `npm run typecheck`
- `npm test` (focused return + inventoryCountSessions + security pins)
- `npm run security:backend`
- `npm run security:static`

## Classification

Controlled pilot-ready for demo + hosted path once the additive migration is deployed.

## Not in scope

- Invitee Auth bootstrap (founder-policy deferred)
- Open PR themes #132–#282
- Persistent per-line Orders undo (runner-up)
