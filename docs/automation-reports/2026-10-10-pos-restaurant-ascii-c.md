# MISE-005MA: pin POS requireWorkflowId restaurant to ASCII C

Date: 2026-10-10  
Branch: `cursor/mise-pos-restaurant-ascii-c`  
Base: `origin/main` @ `78da737`

## Problem

`services/application/pos.ts` local `requireWorkflowId(..., "restaurant")` used
Unicode `String.trim()`. NBSP / em-space padding around a demo workspace token
such as `restaurant_a` would be stripped, inventing a normalized restaurant
identity that matched the unpadded token.

## Change

- Added `services/domain/posRestaurantIdentity.ts` with ASCII-only end trim and
  fail-closed canonicalize/require helpers.
- Routed only the restaurant label of local `requireWorkflowId` through
  `requireCanonicalPosRestaurantId`.
- Preserved `A valid restaurant id is required.` and left mapping / menu item
  labels on Unicode trim with `A valid ${label} id is required.`

## Intentionally out of scope

- Orders workflow `requireWorkflowId` restaurant (#756 / MISE-005LZ)
- Orders authorities `Missing restaurant workspace.` (#754)
- Sibling restaurant workspace tips (#727–#755)
- Non-restaurant POS workflow labels (mapping, menu item)

## Verification

- `tests/posRestaurantAsciiC.test.ts`: 4/4 pass
- `tests/posMappingReviewWorkflow.test.ts`: pass (static requireWorkflowId mapping contract)
- `npm run typecheck`: pass
- `npm run security:static` / `security:backend`: pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (pre-existing `recalculationCycles` cancelledByParent)
