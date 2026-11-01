# Demo draft upsert timezone fail-closed (2026-11-01)

## Defect

`approveRecommendationInDemoState` defaulted a missing restaurant timezone to
`DEMO_RESTAURANT_TIME_ZONE` (`America/New_York`) and passed empty / invalid /
Unicode-padded IANA names into `nextDateKeyInTimeZone` → `toDateKeyInTimeZone`,
which catches Intl failure and invents a UTC calendar next-day delivery date.

## Inventing proof

At `2026-10-31T22:30:00.000Z`:

- valid `Asia/Tokyo` → next delivery date `2026-11-02`
- missing restaurant via `?? DEMO_RESTAURANT_TIME_ZONE` → `2026-11-01`
- empty / padded `\u2003Asia/Tokyo\u2003` / invalid via UTC inventing →
  next delivery date `2026-11-01`

## Change

- `requireRestaurantTimeZoneForDemoDraftUpsert` validates the raw IANA value
  before dating a newly created demo supplier draft
- Do not Unicode-trim into a clean IANA identity
- Do not default omitted zones to `DEMO_RESTAURANT_TIME_ZONE` or `"UTC"`
- Focused inventing proofs in `tests/demoWorkflows.test.ts`

## Ownership

Owns demo draft upsert timezone fail-closed only. Does **not** own supplier
draft generation timezone (#1003), supplier-spend timezone (#1002),
operating-date util (#1001), currency (#1000), localized date (#999), due-time
(#998), home greeting (#997), today-tasks (#996), operating-plan (#995),
daily-phase-brief (#994), daily-closeout (#993), other demo
`demoTimeZone` / `demoRepository` / `demoActivity` timezone defaults, or global
`hourInTimeZone` UTC fallback.

## Verification

- focused demoWorkflows inventing proof
- typecheck; security static/backend; npm test
