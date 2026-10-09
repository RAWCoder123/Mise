# MISE-005LQ daily-phase-brief restaurant workspace ASCII C

Date: 2026-10-09  
Branch: `cursor/mise-daily-phase-brief-restaurant-ascii-c`  
Base: `origin/main` @ `78da737`

## Problem

Unicode `String.trim()` strips NBSP (`U+00A0`) and em-space (`U+2003`) padding.
An application or domain caller that padded a restaurant workspace token with
those characters could invent a normalized identity that matched an unpadded
tenant scope before daily-phase-brief composition ran.

## Change

- Added `services/domain/dailyPhaseBriefRestaurantIdentity.ts` with ASCII-only
  end trim and fail-closed canonicalize/require helpers.
- Wired `services/application/dailyPhaseBrief.ts` (`fetchDailyPhaseBriefs`)
  through `requireCanonicalDailyPhaseBriefWorkspaceId`, preserving
  `Missing restaurant workspace.`
- Wired `services/domain/dailyPhaseBrief.ts` (`buildDailyPhaseBriefs`) through
  `requireCanonicalDailyPhaseBriefRestaurantId`, preserving
  `Daily phase briefs require a restaurant.`
- Non-UUID demo workspace tokens remain valid; UUID shape is not required.
- Sibling restaurant tips were left untouched.

## Tests

- `tests/dailyPhaseBriefRestaurantAsciiC.test.ts` — inventing proofs for NBSP
  and em-space, ordinary ASCII padding stability, empty/control rejection, and
  source pin assertions.
