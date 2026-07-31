# Today action labels + staff waste tip (2026-07-31)

## Problem
1. Today task generation added intents for count sessions, receiving, and POS repair, but the Today UI action-label mapper only handled older intents and fell through to “Manage connection”.
2. Staff waste recording was discoverable from Inventory, but not from the Today command board.

## Change
- Added `presentOperationalTodayTaskAction` in `services/presentation/operationsPresentation.ts` with exhaustive intent coverage and EN/ES/zh-Hans labels.
- Count-session continue vs approve and POS manage vs repair labels diverge via presentation codes while keeping stable task IDs.
- Today `TaskRow` uses the shared presenter instead of a local incomplete mapper.
- Staff-only Today waste tip routes to `/inventory` with localized `today.waste.*` copy.
- Corrected stale `pos.message.csvUnavailable` copy now that CSV import is available.

## Verification
- `tests/operationsPresentation.test.ts` covers every `OperationalTodayTaskActionIntent`.
- `tests/inventoryWaste.test.ts` asserts Today waste tip wiring and catalog keys.
- `npm run typecheck` and `npm test` on this branch tip.
