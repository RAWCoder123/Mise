# MISE-005LS finding-decisions restaurant workspace ASCII C

Date: 2026-10-09  
Branch: `cursor/mise-finding-decisions-restaurant-ascii-c`  
Base: `origin/main` @ `78da737`

## Problem

Unicode `String.trim()` strips NBSP (`U+00A0`) and em-space (`U+2003`) padding.
An application caller that padded a restaurant workspace token with those
characters could invent a normalized identity that matched an unpadded tenant
scope before operational finding-decision history reads ran.

## Change

- Added `services/domain/findingDecisionsRestaurantIdentity.ts` with ASCII-only
  end trim and fail-closed canonicalize/require helpers.
- Wired `services/application/findingDecisions.ts`
  (`fetchOperationalFindingDecisions`) through
  `requireCanonicalFindingDecisionsWorkspaceId`, preserving
  `Missing restaurant workspace.`
- Non-UUID demo workspace tokens remain valid; UUID shape is not required.
- Sibling restaurant tips were left untouched (including deliveries #748 and
  remaining application paths such as dailyReport, orders, waste, findings,
  and activity).

## Tests

- `tests/findingDecisionsRestaurantAsciiC.test.ts` — inventing proofs for NBSP
  and em-space, ordinary ASCII padding stability, empty/control rejection, and
  source pin assertions.
