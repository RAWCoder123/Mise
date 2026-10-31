# Today tasks timezone fail-closed (2026-10-31)

## Defect

`classifyOperationalTodayTaskTiming` and `deriveOperationalTodayTasks` passed
`restaurantTimeZone` into `dateKeyInTimeZone` without validating it.
`dateKeyInTimeZone` catches Intl failure and silently falls back to the UTC
calendar date. Unicode-padded IANA names stay truthy through a Unicode `.trim()`
emptiness gate (`'\u2003America/New_York\u2003'.trim() === 'America/New_York'`)
but fail Intl, so the UTC fallback invents the wrong timing bucket for
date-only delivery commitments (`today` vs `overdue`).

Sibling waste analysis and supplier reliability already fail closed with Intl
on the raw timezone. Daily closeout (#993), daily phase briefs (#994), and
operating plan (#995) own the same pattern for their callers only.

## Inventing proof

At `2026-07-19T03:30:00.000Z` with dueDate `2026-07-18`:

- valid `America/New_York` → local calendar `2026-07-18` → timing `today`
- padded `\u2003America/New_York\u2003` via UTC fallback → calendar
  `2026-07-19` → invents `overdue`

## Change

- `services/domain/todayTasks.ts` — `requireRestaurantTimeZone`: empty →
  `Today tasks require a restaurant timezone.`; invalid/padded →
  `Today tasks require a valid restaurant timezone.`
- Validate at `deriveOperationalTodayTasks` and
  `classifyOperationalTodayTaskTiming` (covers `sortOperationalTodayTasks`)
- Do **not** Unicode-trim into a clean IANA identity; Intl validates the raw
  value
- Leave `dateKeyInTimeZone` last-resort UTC defense, home greeting
  `hourInTimeZone` caller, and #993/#994/#995 / #788/#789 alone

## Verification

- Focused `tests/todayTasks.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

## Ownership

Owns today-tasks timezone fail-closed only. Does **not** own home greeting,
daily-closeout, daily-phase-brief, operating-plan, or global timezone helpers.
