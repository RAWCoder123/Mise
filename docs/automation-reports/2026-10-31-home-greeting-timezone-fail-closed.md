# Home greeting timezone fail-closed (2026-10-31)

## Defect

`greetingKeyForNow` in `app/(tabs)/home.tsx` passed `restaurant.timezone` into
`hourInTimeZone` without validating it. Em-space / NBSP padding stays truthy
through a Unicode `.trim()` emptiness gate, then `hourInTimeZone` catches Intl
failure and silently falls back to the UTC hour — inventing the wrong
morning / afternoon / evening greeting for the restaurant's service day.

## Inventing proof

At `2026-07-19T15:30:00.000Z` with `America/New_York`:

- valid zone → local hour 11 → `morning`
- padded `\u2003America/New_York\u2003` via UTC fallback → hour 15 → invents `afternoon`

Sibling waste analysis / supplier reliability already fail closed with Intl on
the raw timezone. Daily closeout (#993), daily phase briefs (#994), operating
plan (#995), and today-tasks (#996) own the same pattern for their callers only.

## Change

- `services/domain/homeGreeting.ts` — `greetingPeriodForNow` +
  `requireRestaurantTimeZone` (empty → `Home greeting requires a restaurant timezone.`;
  invalid/padded → `Home greeting requires a valid restaurant timezone.`)
- Do not Unicode-trim into a clean IANA identity; Intl validates the raw value
- `app/(tabs)/home.tsx` maps the period to catalog keys; on fail-closed error
  uses time-neutral `home.greeting.hello` so Home does not crash and does not
  invent a time-of-day claim
- EN / ES / ZH catalog parity for `home.greeting.hello`
- Focused proofs in `tests/homeGreeting.test.ts`

## Ownership

Owns home greeting timezone fail-closed only. Does **not** own today-tasks
(#996), operating-plan (#995), daily-phase-brief (#994), daily-closeout (#993),
global `hourInTimeZone` / `dateKeyInTimeZone` UTC fallbacks, or recalculation
timezone tips (#788/#789).
