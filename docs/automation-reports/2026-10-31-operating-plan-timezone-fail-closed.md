# Operating plan timezone fail-closed (2026-10-31)

## Defect

`buildDailyOperatingPlan` called `hourInTimeZone` with the raw `restaurantTimeZone` and never validated it. Em-space / NBSP padding stays truthy through a Unicode `.trim()` emptiness gate. `hourInTimeZone` catches Intl failure and silently falls back to UTC, which can invent the wrong restaurant-local service window (`before_prep` vs `before_lunch`).

Sibling waste analysis and supplier reliability already fail closed with Intl on the raw timezone. Daily closeout (#993) and daily phase briefs (#994) own the same pattern for their callers and do not cover this one.

## Inventing proof

At `2026-08-03T13:00:00.000Z`:

- valid `America/New_York` → local hour 9 → `before_prep`
- Unicode-padded `\u2003America/New_York\u2003` through `hourInTimeZone` → UTC hour 13 → invents `before_lunch`

An urgent `finish_setup` task assigns `serviceWindow` from `currentWindow`, so the invented hour changes the plan item window.

## Change

- `services/domain/operatingPlan.ts` — `requireRestaurantTimeZone`: empty → `Operating plan requires a restaurant timezone.`; invalid/padded → `Operating plan requires a valid restaurant timezone.`
- Do not Unicode-trim into a clean IANA identity; Intl validates the raw value
- Leave `hourInTimeZone` UTC fallback; leave daily-closeout (#993), daily-phase-brief (#994), and recalculation timezone tips (#788/#789) alone
- Focused proofs in `tests/operatingPlan.test.ts`

## Ownership

Owns operating-plan timezone fail-closed only. Does **not** own daily-closeout, daily-phase-brief, or global `hourInTimeZone` behavior.
