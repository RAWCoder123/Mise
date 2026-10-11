# MISE-005NF: pin recalculation-schedule restaurantTimeZone to ASCII C

## Summary

Pins domain `buildRecalculationSchedule` `restaurantTimeZone` to ASCII-only end
trim so NBSP/em-space padding cannot invent an exact IANA timezone match used
for service-day and cycle-window evaluation beside the unpadded restaurant
timezone.

## Why

On `main`, `buildRecalculationSchedule` did:

```ts
const timeZone = input.restaurantTimeZone.trim();
if (!timeZone) throw new Error("Recalculation scheduling requires a restaurant timezone.");
```

A value like `\u00a0America/New_York\u00a0` Unicode-trims to `America/New_York`,
passes emptiness, and drives `serviceDayInTimeZone` / cycle windows as if the
caller sent the canonical restaurant timezone — a parallel timezone identity.

Sibling wasteAnalysis / supplierReliability timezone helpers are different: they
emptiness-check with Unicode trim but Intl-validate the raw padded string, so
padded IANA tokens fail closed rather than inventing a service day. Those paths
are left alone.

## Changes

- Add `services/domain/recalculationScheduleTimeZoneIdentity.ts`
- Wire `requireCanonicalRecalculationScheduleTimeZone` into
  `buildRecalculationSchedule`
- Preserve `Recalculation scheduling requires a restaurant timezone.` error
  contract
- Leave restaurant-workspace tip #733 and application scheduled-recalculation
  tip #735 alone

## Verification

- Focused: `recalculationScheduleTimeZoneAsciiC` + `recalculationSchedule` — 16/16
- `npm run typecheck` — pass
- `npm run security:static` / `npm run security:backend` — pass
- `npm test` — 687 total / 680 pass / 0 fail / 7 cancelled (pre-existing
  `recalculationCycles` timeout flake)
