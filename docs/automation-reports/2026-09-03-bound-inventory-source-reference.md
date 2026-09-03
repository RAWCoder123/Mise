# Bound inventory event source_reference (2026-09-03)

Tip: `cursor/mise-bound-inventory-source-reference`
Base: `origin/main` @ `20b28e5`.

## Problem
Operator validation already capped source references at 200 characters, but
`inventory_events.source_reference` and every insert path (including
`record_inventory_event`) accepted unbounded text. A direct RPC caller could
store oversized ledger references and inflate audit/export payloads.

## Fix
- Shared limit in `services/domain/securityLimits.ts`
- Domain accept path rejects `source_reference_too_long`
- Client validation uses the shared constant
- Additive migration: table CHECK + BEFORE INSERT trigger (covers RPC, count
  approval, and outbox without re-declaring `record_inventory_event`)
- pgTAP + static migration pins

## Limits
- source_reference ≤ 200 characters

## Contested
Expect rebase vs #367/#368 on `inventory_event_ledger.test.sql` plan count.
Does not redeclare `record_inventory_event`, so it composes with #368's RPC
body. Do not invent MOQ/lead_time/expiration.
