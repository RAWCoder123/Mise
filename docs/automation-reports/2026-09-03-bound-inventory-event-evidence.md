# Bound inventory event reason_code and metadata (2026-09-03)

Tip: `cursor/mise-bound-inventory-event-evidence`
Base: `origin/main` @ `20b28e5`.

## Problem
Operator validation already capped reason codes (80) and notes (500), but
`public.record_inventory_event` accepted unbounded `p_reason_code` / `p_metadata`.
A direct RPC could store oversized ledger evidence.

## Fix
- Shared limits in `services/domain/securityLimits.ts`
- Domain accept path rejects `reason_code_too_long` / `metadata_too_large`
- Client validation uses the shared constants
- Additive migration: table CHECKs + RPC fail-fast before advisory lock
- pgTAP + static migration pins

## Limits
- reason_code ≤ 80 characters
- metadata ≤ 8192 UTF-8 bytes of `metadata::text` (audit-log parity)

## Contested
Expect rebase vs #367 on `inventory_event_ledger.test.sql` / `inventoryLedger.ts`.
Do not invent MOQ/lead_time/expiration.
