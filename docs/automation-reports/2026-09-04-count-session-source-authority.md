# Count session source authority (2026-09-04)

Tip: `cursor/mise-count-session-source-authority`
Base: `origin/main` @ `20b28e5`

## Problem

Physical counts replace projected on-hand and become the authority boundary for
POS depletion and purchasing. Inventory detail still queued single-item
`operator_count` replaces, and `record_inventory_event` accepted any manager
`count` row (including `manual_count`). That skipped variance review and session
provenance while still overwriting stock.

## Fix

- Retire detail Count ops; managers get a Physical count card to `/inventory/count`
- Client validation rejects `count` so the outbox cannot mint `operator_count`
- Domain `acceptInventoryEvent` requires `source = approve_count_session` for counts
- Hosted: RPC rejects all count inserts; BEFORE INSERT trigger requires session source
- pgTAP flipped: manager RPC count fails; spoofed session source fails; service_role
  seeds session-sourced counts for projection fixtures
- EN/ES/zh-Hans copy updated

## Verification

- `npm run typecheck`
- focused ledger / validation / outbox / transport / UI / security pins
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run supabase:test` when Docker is available

## Notes

- Completes the hosted follow-up deferred by open #388 and supersedes its client-only
  retirement with server enforcement.
- Does not invent MOQ/lead_time/expiration.
- Distinct from waste on-hand (#383), usage (#365), adjustment (#348), count resume (#384).
