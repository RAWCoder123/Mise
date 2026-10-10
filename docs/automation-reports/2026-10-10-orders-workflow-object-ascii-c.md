# MISE-005MC orders requireWorkflowId object labels ASCII C

Date: 2026-10-10  
Branch: `cursor/mise-orders-workflow-object-ascii-c`  
Base: `origin/main` @ `78da737`

## Problem

Orders application `requireWorkflowId` for labels `supplier order`,
`purchase decision event`, and `supplier` used Unicode `String.prototype.trim()`.
NBSP (`U+00A0`) or em-space (`U+2003`) padding around a valid object id would
still normalize to that id, inventing a workflow identity the operator never
typed as an ASCII-bounded token.

## Change

- Added `services/domain/ordersWorkflowObjectIdentity.ts` with ASCII-only end
  trim and fail-closed canonicalize/require helpers.
- Routed only those three labels through
  `requireCanonicalOrdersWorkflowObjectId` in `services/application/orders.ts`.
- Preserved `Missing ${label}.`
- Left `restaurant` on Unicode trim (owned by #756 / MISE-005LZ).
- Left authorities `Missing restaurant workspace.` on Unicode trim (#754).
- Left POS and sibling restaurant tips untouched.
- Non-UUID demo tokens (e.g. `pde-demo-event`) intentionally preserved; no UUID
  shape gate on these paths.

## Merge note

When landing with #756, keep both restaurant and object-label branches in
`requireWorkflowId`. Drop any assertion that object labels still use Unicode
`value.trim()`; this tip owns those labels. #756 owns restaurant
`Missing restaurant.`; #754 owns authorities `Missing restaurant workspace.`.

## Verification

- `tests/ordersWorkflowObjectAsciiC.test.ts`: 4/4
- `tests/gmailClient.test.ts`: pass (restaurant path still Unicode trim)
- `npm run typecheck`: pass
- `npm run security:static` / `npm run security:backend`: pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (pre-existing recalculationCycles)
