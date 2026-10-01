# Supplier confirmation (manager manual) — 2026-09-01

Tip: `cursor/mise-supplier-confirmation-manual`
Base: `origin/main` @ `20b28e5`

## Completed

Managers can record supplier confirmation evidence on sent or completed
orders without inventing confirmation from send/receive state.

- Authenticated RPC `public.record_supplier_confirmation` (SECURITY DEFINER,
  `auth.uid()` actor, owner/admin/manager only) wrapping
  `private.service_record_supplier_confirmation`
- Keeps `public.service_record_supplier_confirmation` service_role-only
- Demo + hosted repository read/write parity and export dataset population
- Orders detail: confirmation evidence list + manager status chips + optional
  reference
- EN / ES / zh-Hans catalog keys
- Domain, demo, and migration static tests; pgTAP coverage file

## Current product state

Controlled pilot-ready code path for purchase-loop confirmation evidence.
Still not App Store submission-ready (founder legal URLs, EAS, hosted
migration deploy, live POS/Gmail, physical device).

## Next highest-priority work

Land/rebase open stacks (#147–#335). Then ingredient substitutions write RPC
(Codex) or yield write authority (Codex) — avoid inventing MOQ/lead/expiry.

## Blockers

- Deploy additive migration to staging / hosted re-proof
- Docker/hosted pgTAP when available
- Founder privacy/support/terms HTTPS + EAS / Apple Developer
