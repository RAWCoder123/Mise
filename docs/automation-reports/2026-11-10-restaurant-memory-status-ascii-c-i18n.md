# MISE-005ABU: localize Restaurant Memory memory.status under ASCII C

Date: 2026-11-10
Branch: `cursor/mise-restaurant-memory-status-ascii-c-i18n`

## Surface

Restaurant Memory hub card meta previously always-passed raw `memory.status`
(`active`, `confirmed`, `corrected`, `dismissed`, `forgotten`, `disabled`)
between confidence and updated date with no localization and no ASCII C prep.

## Change

- Added `services/domain/presentationRestaurantMemoryStatusIdentity.ts`
- Wired `app/more/restaurant-memory.tsx` through
  `resolveRestaurantMemoryStatusMessageKey`
- Added EN / ES / zh-Hans `memory.statusCode.*` catalog keys
- Soft-null / unknown / unsafe tokens → localized `memory.statusCode.unknown`

## Left alone

- `memory.memoryType` raw humanize (owned by MISE-005ABT / #1230)
- statement (#830), evidence.summary (#1154), correction draft (#848)
- subtitle restaurant.name (#1042), scope/source (#841)
- domain `convertMemoryToRule` title humanize
- Autonomy actionType / evidence.type leave-alone
- Activity evidence.type (#1225)

## Verification

Focused and suite results recorded in the PR body after gates run.
