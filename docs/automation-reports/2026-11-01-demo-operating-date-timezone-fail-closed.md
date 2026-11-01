# Demo operating-date timezone fail-closed (2026-11-01)

## Defect

`demoTimeZone` (used by `demoOperatingDate` and `demoCountEvidence`) defaulted a
missing restaurant timezone to `DEMO_RESTAURANT_TIME_ZONE` (`America/New_York`)
and passed empty / invalid / Unicode-padded IANA names into
`toDateKeyInTimeZone`, which catches Intl failure and invents a UTC calendar day
for demo recommendation rebuild and insight rebuild.

## Inventing proof

At `2026-10-31T22:30:00.000Z`, with a POS sale dated `2026-11-01`:

- valid `Asia/Tokyo` → operating date `2026-11-01` → sales insight includes the sale
- missing restaurant via `?? DEMO_RESTAURANT_TIME_ZONE` → `2026-10-31` → sale excluded
- empty / padded `\u2003Asia/Tokyo\u2003` / invalid via UTC inventing → `2026-10-31` → sale excluded

## Change

- `requireRestaurantTimeZoneForDemoOperatingDate` validates the raw IANA value
  before dating demo operating-date and count-evidence windows
- Do not Unicode-trim into a clean IANA identity
- Do not default omitted/missing zones to `DEMO_RESTAURANT_TIME_ZONE` or `"UTC"`
- Focused inventing proofs in `tests/demoWorkflows.test.ts` via `rebuildInsights`

## Ownership

Owns demo operating-date / count-evidence timezone fail-closed
(`demoTimeZone` → `demoOperatingDate` / `demoCountEvidence`) only. Does **not**
own demo draft upsert (#1004), demo activity seed (#1007), demo waste recording
(#1006), demo sales date (#1005), drafts generation (#1003), supplier-spend
(#1002), operating-date util (#1001), currency (#1000), localized date (#999),
due-time (#998), home greeting (#997), today-tasks (#996), operating-plan (#995),
daily-phase-brief (#994), daily-closeout (#993), other `demoRepository`
timezone defaults, or global `hourInTimeZone` UTC fallback.

## Verification

- focused demoWorkflows inventing proof
- typecheck; security static/backend; npm test
