# MISE-005NG scheduled-recalculation timezone ASCII C

Date: 2026-10-11

## Finding

Application `runScheduledRecalculations` Unicode-trimmed `restaurantTimeZone`
before Home/Today cycle dispatch. NBSP/em-space padding around a valid IANA
token invents the unpadded timezone identity (`'\u00a0America/New_York\u00a0'.trim()
=== 'America/New_York'`), so padded tokens enter recalculation cycles as the
restaurant timezone.

## Change

- Added `services/domain/scheduledRecalculationTimeZoneIdentity.ts` with
  ASCII-only end trim and fail-closed canonicalize/require helpers.
- Routed `runScheduledRecalculations` through
  `canonicalizeScheduledRecalculationTimeZone` (fail-soft `null`, never throws).
- Preserved `Missing restaurant timezone.` for hard-error callers.
- Length capped at 128.
- Left scheduled-recalculation restaurant workspace tip #735 and domain
  recalculation-schedule timezone tip #788 alone (separate modules and error
  contracts). Left wasteAnalysis / supplierReliability / dailyCloseout timezone
  emptiness alone (Intl/raw fail-closed, not inventing).

## Tests

- `tests/scheduledRecalculationTimeZoneAsciiC.test.ts`
- `npm run typecheck`
- Focused tip suite
- `npm test`
- `npm run security:static` + `npm run security:backend`
