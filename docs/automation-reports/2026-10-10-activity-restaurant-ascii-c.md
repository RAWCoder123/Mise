# MISE-005LW activity restaurant workspace ASCII C

Date: 2026-10-10  
Branch: `cursor/mise-activity-restaurant-ascii-c`  
Base: `origin/main` @ `78da737`

## Summary

Pins application `activity.ts` restaurant workspace identity to ASCII-only end
trim so Unicode `String.trim()` cannot invent a tenant identity from NBSP or
em-space padding before Activity History feed reads.

## Change

- Adds `services/domain/activityRestaurantIdentity.ts` with fail-closed
  canonicalize/require helpers
- Routes `fetchActivityEvents` (and callers) through
  `requireCanonicalActivityWorkspaceId` while preserving
  `Missing restaurant workspace.`
- Preserves non-UUID demo workspace tokens (`restaurant_a`)
- Leaves findings (#752), waste (#751), dailyReport (#750), findingDecisions
  (#749), deliveries (#748), orders workspace, domain activity-event (#729),
  domain `operationalFindings` trim, and other sibling restaurant tips untouched

## Verification

- `tests/activityRestaurantAsciiC.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
