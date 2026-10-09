# MISE-005LR deliveries restaurant workspace ASCII C

Date: 2026-10-09  
Branch: `cursor/mise-deliveries-restaurant-ascii-c`  
Base: `origin/main` @ `78da737`

## Problem

Unicode `String.trim()` strips NBSP (`U+00A0`) and em-space (`U+2003`) padding.
An application caller that padded a restaurant workspace token with those
characters could invent a normalized identity that matched an unpadded tenant
scope before delivery history reads or supplier-order receive writes ran.

## Change

- Added `services/domain/deliveriesRestaurantIdentity.ts` with ASCII-only end
  trim and fail-closed canonicalize/require helpers.
- Wired `services/application/deliveries.ts`
  (`fetchDeliveryHistory`, `receiveSupplierOrderDelivery`) through
  `requireCanonicalDeliveriesWorkspaceId`, preserving
  `Missing restaurant workspace.`
- Non-UUID demo workspace tokens remain valid; UUID shape is not required.
- Sibling restaurant tips were left untouched.

## Tests

- `tests/deliveriesRestaurantAsciiC.test.ts` — inventing proofs for NBSP and
  em-space, ordinary ASCII padding stability, empty/control rejection, and
  source pin assertions.
