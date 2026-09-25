# Projection-applied parity (2026-09-25)

## Problem

Hosted inventory retains delayed ledger rows with `projection_applied = false`
and skips on-hand floor/ceiling checks for those rows. Demo mode still validated
projected quantity against **current** on-hand before deciding whether the row
applied, so a delayed waste/usage that would breach current stock was rejected
even though hosted would accept it.

Separately, `projectInventoryEvents` ignored `projectionApplied` and could
double-count retained history when reconstructing on-hand from the ledger.

## Change

1. `services/repositories/demoRepository.ts` — stamp `projectionApplied` first;
   enforce floor/ceiling and mutate `current_quantity` only when applied.
2. `services/domain/inventoryLedger.ts` — skip rows with
   `projectionApplied === false` (absent → treat as applied, fail-closed).
3. Tests for domain projector, authoritative count pin, and demo parity.

## Verification

- `npm run typecheck`
- `npm test` (681 passed, 0 failed, 7 cancelled)
- focused: inventoryLedger + demoInventoryProjectionApplied + authoritativeInventoryCount + inventoryReconciliation (55/55)
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `supabase:test` blocked (no Docker)

## Not in scope

Open stacks #348–#403 (usage/adjustment floors, export, orphan mutators, etc.).
No migration — hosted DB already correct.
