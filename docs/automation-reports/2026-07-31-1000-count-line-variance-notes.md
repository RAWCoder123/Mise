# Count-line variance notes (2026-07-31)

## Problem
`inventory_count_lines.note` existed in schema, but save RPCs, Edge validation, demo merge, and the count UI ignored it. Variance explanations could not be captured during multi-item counts or carried into approved ledger rows.

## Change
- Migration `20260731100000_count_line_variance_notes.sql` updates save + approve service RPCs to persist optional ≤240-char line notes and copy them into `inventory_movements.metadata.note` on approve.
- Domain/validation/Edge accept optional notes on count-line saves.
- Demo approve path includes notes in ledger metadata.
- Count session UI adds optional per-line note fields with EN/ES/ZH copy.

## Verification
- Unit coverage for merge/plan note behavior and static security contract for the new migration/UI/Edge path.
- Follow with `npm run typecheck` and `npm test` on this branch tip.
