# Supplier draft timezone fail-closed (2026-10-31)

## Defect

`buildDraftsFromRecommendations` defaulted omitted `options.timeZone` to `"UTC"`
and passed empty / invalid / Unicode-padded IANA names into
`nextDateKeyInTimeZone` → `toDateKeyInTimeZone`, which catches Intl failure and
invents a UTC calendar delivery day.

## Inventing proof

At `2026-10-31T22:30:00.000Z`:

- valid `Asia/Tokyo` → next delivery date `2026-11-02`
- omitted / empty / padded `\u2003Asia/Tokyo\u2003` / invalid via UTC inventing →
  next delivery date `2026-11-01`

## Change

- `requireRestaurantTimeZoneForDrafts` validates the raw IANA value before dating
- Do not Unicode-trim into a clean IANA identity
- Do not default omitted zones to `"UTC"`
- Focused inventing proofs in `tests/algorithmBoundaries.test.ts`
- Existing draft callers that previously omitted timezone now pass an explicit
  restaurant timezone

## Ownership

Owns supplier draft generation timezone fail-closed only. Does **not** own
supplier-spend timezone (#1002), operating-date util (#1001), currency (#1000),
localized date (#999), due-time (#998), home greeting (#997), today-tasks
(#996), operating-plan (#995), daily-phase-brief (#994), daily-closeout (#993),
demo draft upsert timezone defaults, or global `hourInTimeZone` UTC fallback.

## Verification

- focused algorithmBoundaries inventing proof
- typecheck; security static/backend; npm test
