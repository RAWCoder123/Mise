# Demo sales date timezone fail-closed (2026-11-01)

## Defect

`refreshLocalDemoSalesDate` defaulted a missing restaurant timezone to `"UTC"`
and passed empty / invalid / Unicode-padded IANA names into
`toDateKeyInTimeZone`, which catches Intl failure and invents a UTC calendar
day for rolling demo POS `sale_date` stamps.

## Inventing proof

At `2026-10-31T22:30:00.000Z`:

- valid `Asia/Tokyo` → rolling sale date `2026-11-01`
- missing / empty / padded `\u2003Asia/Tokyo\u2003` / invalid via UTC inventing →
  rolling sale date `2026-10-31`

## Change

- `requireRestaurantTimeZoneForDemoSalesDate` validates the raw IANA value
  before stamping rolling demo POS sales dates
- Do not Unicode-trim into a clean IANA identity
- Do not default omitted zones to `"UTC"`
- Focused inventing proofs in `tests/demoSalesDateTimezone.test.ts`

## Ownership

Owns **demo sales date refresh** timezone fail-closed only. Does **not** own
demo draft upsert timezone (#1004), supplier draft generation timezone (#1003),
supplier-spend timezone (#1002), operating-date util (#1001), currency (#1000),
localized date (#999), due-time (#998), home greeting (#997), today-tasks
(#996), operating-plan (#995), daily-phase-brief (#994), daily-closeout (#993),
demo waste-activity timezone inventing in `demoActivity` / waste recording in
`demoRepository`, other `demoTimeZone` defaults, or global `hourInTimeZone`
UTC fallback.

## Verification

- focused demoSalesDateTimezone inventing proof
- typecheck; security static/backend; npm test
