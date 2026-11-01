# Demo activity seed timezone fail-closed (2026-11-01)

## Defect

`seedDemoActivityFromState` defaulted a missing restaurant timezone to `"UTC"`
when dating historical waste activity windows, and passed empty / invalid /
Unicode-padded IANA names into `toDateKeyInTimeZone`, which catches Intl failure
and invents a UTC calendar day for the repeated-waste attention signal.

## Inventing proof

Two waste events at `2026-10-31T10:00:00.000Z` and `2026-10-31T22:30:00.000Z`:

- valid `Asia/Tokyo` → distinct days `2026-10-31` and `2026-11-01` →
  `repeatedRecently` / attention true (`Waste pattern needs review`)
- empty / padded `\u2003Asia/Tokyo\u2003` / invalid / omitted / orphan restaurant
  via UTC inventing → both days collapse to `2026-10-31` → attention suppressed
  (`Waste recorded and analyzed`)

## Change

- `requireRestaurantTimeZoneForDemoActivitySeed` validates the raw IANA value
  before dating seed waste-activity windows
- Do not Unicode-trim into a clean IANA identity
- Do not default omitted / missing zones to `"UTC"`
- Focused inventing proofs in `tests/demoActivitySeedTimezone.test.ts`

## Ownership

Owns `seedDemoActivityFromState` waste-activity timezone fail-closed only. Does
**not** own demo waste recording (#1006), demo sales date refresh (#1005), demo
draft upsert (#1004), drafts generation (#1003), supplier-spend (#1002),
operating-date util (#1001), currency (#1000), localized date (#999), due-time
(#998), home greeting (#997), today-tasks (#996), operating-plan (#995),
daily-phase-brief (#994), daily-closeout (#993), other `demoTimeZone` defaults
in `demoWorkflows` / `demoRepository`, or global `hourInTimeZone` UTC fallback.

## Verification

- focused demoActivitySeedTimezone inventing proof
- typecheck; security static/backend; npm test
