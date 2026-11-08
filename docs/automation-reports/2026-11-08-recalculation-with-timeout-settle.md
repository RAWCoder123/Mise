# Recalculation withTimeout settle fix (2026-11-08)

## Problem

`tests/recalculationCycles.test.ts` never actually completed the hung-cycle
`withTimeout` proof. Production `withTimeout` unrefs its timer so a hung cycle
cannot pin a worker process; under `node:test` that unref lets the event loop
drain before the 10ms timeout fires (`cancelledByParent` / `Promise resolution
is still pending but the event loop has already resolved`). The remaining
timeout, ledger-fail-closed, dead-letter, and telemetry proofs in the same file
were cancelled with it.

## Change

- Harden `withTimeout` with a one-shot `settled` guard so late work settlement
  after a timeout cannot invent a second resolve/reject path. Keep `unref`.
- Hold a short ref'd keep-alive timer in the hung-cycle and late-settlement
  proofs so the unref'd timeout can win, then settle the hung work so siblings
  are not cancelled.
- Add a focused late-settlement proof that the timeout winner stays authoritative.

## Verification

- Focused `tests/recalculationCycles.test.ts`
- `npm run typecheck`
- `npm test` (expect 0 cancelled in this file)
- `npm run security:static` / `security:backend`

## Alone-OK

Does not share modules with open recalculation describeError ASCII tip #928 or
scheduled-dispatch tips #1091–#1095. No migration.
