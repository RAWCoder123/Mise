# Daily closeout restaurant timezone fail-closed (2026-10-31)

Branch: `cursor/mise-daily-closeout-timezone-fail-closed`
Base: `origin/main` @ `78da737`

## Defect

`buildDailyCloseoutSummary` only emptiness-checked `restaurantTimeZone` via
Unicode `.trim()`, then called `hourInTimeZone`. Invalid or Unicode-padded
IANA names (for example `'\u2003America/New_York\u2003'`) stayed truthy through
the emptiness gate. `hourInTimeZone` catches Intl failure and silently falls
back to UTC, which can invent the wrong restaurant-local closeout phase
(`progress` vs `closing`).

Sibling waste analysis and supplier reliability already fail closed with Intl
validation on the raw timezone. Daily closeout did not.

## Change

- `services/domain/dailyCloseout.ts` — `requireRestaurantTimeZone` mirrors the
  waste/supplier fail-closed contract: empty after trim rejects with the prior
  `Daily closeout requires a restaurant timezone.`; invalid/padded IANA names
  reject with `Daily closeout requires a valid restaurant timezone.` before
  `hourInTimeZone` can fall back to UTC.
- Do not Unicode-trim into a clean timezone identity. Intl validates the raw
  value so padding cannot invent a usable zone.
- Leave `hourInTimeZone` UTC fallback, daily-phase-brief, operating-plan, and
  recalculation timezone tips (#788 / #789) alone.

## Verification

- Focused `tests/dailyCloseout.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`
