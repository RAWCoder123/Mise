# MISE-005LY: pin operational-findings restaurant workspace to ASCII C

Date: 2026-10-10  
Base: `origin/main` @ `78da737`

## Problem

Domain `buildDailyOperationalBrief` used Unicode `String.trim()` on
`input.restaurantId`. NBSP/em-space padding could invent a restaurant workspace
identity before tenant-scope validation and finding assembly. Application
findings (#752) and operating-brief (#746) tips do not cover this domain entry.

## Change

- Add `services/domain/operationalFindingsRestaurantIdentity.ts` (ASCII end trim
  + fail-closed canonicalize/require).
- Wire only `buildDailyOperationalBrief` through
  `requireCanonicalOperationalFindingsWorkspaceId`.
- Preserve `Missing restaurant workspace.` and demo non-UUID tokens
  (`restaurant_a`).
- Leave `services/application/findings.ts` (#752), orders `requireWorkflowId`,
  and other sibling restaurant tips untouched.

## Verification

- `tests/operationalFindingsRestaurantAsciiC.test.ts`: 4/4 pass
- `tests/operationalFindings.test.ts`: regression pass (with ASCII suite: 14/14)
- `npm run typecheck`: pass
- `npm run security:static` / `security:backend`: pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (pre-existing `recalculationCycles` cancelledByParent)
