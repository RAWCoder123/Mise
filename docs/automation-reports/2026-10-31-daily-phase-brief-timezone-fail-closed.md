# Daily phase brief timezone fail-closed (2026-10-31)

## Defect

`buildDailyPhaseBriefs` only emptiness-checked `restaurantTimeZone` with Unicode `.trim()`, then called `hourInTimeZone`. Em-space / NBSP padding stayed truthy through the empty gate. `hourInTimeZone` catches Intl failure and silently falls back to UTC, which can invent the wrong restaurant-local daily brief phase (`morning` vs `pre_service` vs `closing`).

Sibling waste analysis and supplier reliability already fail closed with Intl on the raw timezone. Daily closeout (#993) owns the same pattern for closeout phases and does not cover this caller.

## Inventing proof

At `2026-08-03T13:00:00.000Z`:

- valid `America/New_York` → local hour 9 → `morning`
- Unicode-padded `\u2003America/New_York\u2003` through `hourInTimeZone` → UTC hour 13 → invents `pre_service`

## Change

- `services/domain/dailyPhaseBrief.ts` — `requireRestaurantTimeZone`: empty → prior timezone error; invalid/padded → `Daily phase briefs require a valid restaurant timezone.`
- Do not Unicode-trim into a clean IANA identity; Intl validates the raw value
- Leave `hourInTimeZone` UTC fallback, operating-plan callers, daily-closeout (#993), and recalculation timezone tips (#788/#789) alone
- Focused proofs in `tests/dailyPhaseBrief.test.ts`

## Ownership

Owns daily-phase-brief timezone fail-closed only. Does **not** own operating-plan, daily-closeout, or global `hourInTimeZone` behavior.
