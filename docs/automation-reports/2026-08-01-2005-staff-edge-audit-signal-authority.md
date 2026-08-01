# Staff Edge audit and signal authority (2026-08-01)

Branch: `cursor/mise-product-inspection-86e2`  
Base tip: `6635730` (`cursor/mise-product-inspection-7300`)

## Problem

Edge allows staff to record waste, draft/submit counts, transfer inventory, and update profile/locale, then always writes an Edge audit log. SQL helpers still required manager+ for:

1. `private.fetch_operational_planning_snapshot` (blocks staff `record_waste` planning)
2. `private.commit_operational_signals` (rolls back staff waste after inventory mutation)
3. `private.service_record_edge_audit_log` (fails after successful staff mutations)

pgTAP already expected staff waste to succeed, but the helper role checks made that path impossible.

## Fix

Migration `20260801201000_staff_edge_audit_and_signal_authority.sql`:

- Allow staff on planning snapshot fetch and signal commit (service-role only; Edge still gates manager-only actions).
- Make Edge audit action-aware: staff may only persist staff-authorized action names.
- Correct pgTAP on-hand expectations after successful staff waste (35 → 33) and add audit/snapshot probes.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`

Docker `supabase:test` and hosted staging remain environment-blocked.

## Classification

Still **controlled pilot-ready code** pending Docker + hosted security gate re-run. Not App Store submission-ready.
