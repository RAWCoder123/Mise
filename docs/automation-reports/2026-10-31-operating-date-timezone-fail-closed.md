# Operating date timezone fail-closed (2026-10-31)

## Defect

`toDateKeyInTimeZone` in `utils/format.ts` caught Intl failures and fell back
to `date.toISOString().slice(0, 10)`, inventing a UTC calendar day for empty,
invalid, or Unicode-padded restaurant IANA timezones. Application operating
dates for Today, operating plan, operating brief, waste windows, findings, and
inventory evidence all flow through this helper, so a padded timezone silently
shifted the restaurant's operating day near timezone boundaries.

## Inventing proof

At `2026-10-31T22:30:00.000Z`:

- valid `Asia/Tokyo` → `2026-11-01`
- padded `\u2003America/New_York\u2003` via UTC fallback → `2026-10-31` (invented)
- invalid `Not/A_Zone` / `Invalid/Timezone` via UTC fallback → `2026-10-31` (invented)
- empty `""` / Unicode-only space via UTC fallback → `2026-10-31` (invented)

## Change

- `requireOperatingDateTimeZone` validates the raw IANA value (empty →
  `Operating date requires a restaurant timezone.`; invalid/padded →
  `Operating date requires a valid restaurant timezone.`)
- Do not Unicode-trim into a clean IANA identity
- Incomplete `formatToParts` after validation also fails closed (no UTC invent)
- `nextDateKeyInTimeZone` inherits via `toDateKeyInTimeZone`
- Update the miseDomain operating-date assertion that previously expected UTC
  inventing for `Invalid/Timezone`

## Ownership

Owns `utils/format.ts` `toDateKeyInTimeZone` / `nextDateKeyInTimeZone`
invalid-timezone UTC inventing only. Does **not** own:

- `formatLocalizedCurrency` USD inventing (#1000)
- `formatLocalizedDate` timezone strip inventing (#999)
- due-time calendar timezone (#998)
- home greeting timezone (#997)
- today-tasks timezone (#996)
- operating-plan domain timezone (#995)
- daily-phase-brief timezone (#994)
- daily-closeout timezone (#993)
- recalculation timezone ASCII tips (#788/#789)
- global `hourInTimeZone` UTC fallback (intentional until a dedicated decision)

## Verification

- focused `tests/operatingDateTimeZoneFailClosed.test.ts`
- `tests/miseDomain.test.ts` operating-date assertion
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
