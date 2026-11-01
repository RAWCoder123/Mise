# Demo dataset rebuild timezone fail-closed (2026-11-01)

## Defect

`applyDefaultDemoDataset` defaulted missing restaurant timezone to
`DEMO_RESTAURANT_TIME_ZONE` (`America/New_York`) and passed empty / invalid /
Unicode-padded IANA names into `toDateKeyInTimeZone`, inventing a UTC calendar
day for reference-dataset POS sales, delivery dates, and related seed windows.

## Inventing proof

At `2026-10-31T22:30:00.000Z`:

- valid `Asia/Tokyo` → current-day sale date `2026-11-01`
- missing / empty / padded `\u2003Asia/Tokyo\u2003` / invalid via NYC or UTC
  inventing → `2026-10-31`

## Change

- `requireRestaurantTimeZoneForDemoDataset` validates the raw IANA value before
  dating demo reference-dataset sales and delivery windows
- Do not Unicode-trim into a clean IANA identity
- Do not default omitted/missing zones to `DEMO_RESTAURANT_TIME_ZONE` or `"UTC"`
- Export `applyDefaultDemoDataset` so inventing proofs can call the rebuild path
  directly after mutating the restaurant timezone
- Focused inventing proofs in `tests/demoDatasetTimezone.test.ts`

## Ownership

Owns **demo reference-dataset rebuild** timezone fail-closed
(`applyDefaultDemoDataset` / `requireRestaurantTimeZoneForDemoDataset`) only.
Does **not** own:

- demo operating-date / count-evidence (#1008)
- demo activity seed (#1007)
- demo waste recording (#1006)
- demo sales date refresh (#1005)
- demo draft upsert (#1004)
- drafts generation (#1003)
- supplier-spend (#1002)
- operating-date util (#1001)
- currency (#1000)
- localized date (#999)
- due-time / home / today / operating-plan / phase-brief / closeout (#998–#993)
- other `demoRepository` timezone defaults
- global `hourInTimeZone` UTC fallback

`createInitialDemoState` still assigns `DEMO_RESTAURANT_TIME_ZONE` as the
authoritative seed restaurant timezone before the preset runs; that intentional
dataset identity is unchanged.

## Verification

- focused `tests/demoDatasetTimezone.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
