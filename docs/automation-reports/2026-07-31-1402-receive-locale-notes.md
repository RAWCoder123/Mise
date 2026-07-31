# Supplier receive: locale quantities + line notes (2026-07-31)

## Problem
1. Order receive UI parsed quantities with `Number(raw)`, which rejects common Spanish decimal forms such as `9,5` and can misread grouped input.
2. Backend receive planning already stores optional per-line notes in `inventory_movements.metadata`, but the UI always submitted `note: null`, so discrepancy explanations were lost.

## Change
- Added pure helpers in `services/domain/supplierOrderReceiving.ts`:
  - `buildReceiveLinesFromFormInputs`
  - `isReceiveQuantityInputReady`
  - `normalizeReceiveNoteInput`
- Order detail receive flow now uses `parseNumber` / locale-formatted defaults, validates notes (≤240), and submits notes through `receiveSupplierOrder`.
- Added EN/ES/zh-Hans copy for note labels, validation, and invalid-quantity notices.

## Verification
- `tests/supplierOrderReceiving.test.ts` covers Spanish parsing, note trim/too-long, and invalid empty quantity.
- `tests/ordersUi.test.ts` asserts the detail screen no longer uses `Number(raw)` and wires note fields.
- `npm run typecheck`, `npm test` (220), `npm run security:backend`, `npm run design:static`.

## Classification impact
Still controlled pilot / private-beta oriented. Receiving was already ledger-backed; this closes a localization and auditability gap on the operator path. Remaining open: pending invite claim, transfers (founder/pilot), Docker/hosted re-proof, Auth email invites, privacy/support URLs, Apple/EAS/device QA, live POS/Gmail.
