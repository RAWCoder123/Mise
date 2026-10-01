# Home approval structured evidence — 2026-08-27

## Completed

- Home approval cards now surface grounded decision evidence already computed by
  `buildOperatingBrief`: confidence score, confidence rationale, expected
  operational impact, risk if ignored, and capped completed-work bullets.
- Progressive disclosure shows two evidence bullets by default and expands to
  three without inventing additional claims.
- EN / ES / zh-Hans chrome labels added for the new evidence rows.
- Pure presentation helper + unit tests keep formatting fail-closed on blank or
  non-finite values.

## Workflows

- Operator opens Home → Needs your approval → sees why, confidence, impact,
  risk, and what Mise already checked before one-tap approve / review.

## Verification

- `npm run typecheck`
- Focused presentation tests
- `npm test`

## Not claimed

- Domain English strings inside `operatingBrief.ts` remain English (separate
  localization slice).
- Does not change recommendation quantities, purchase authority, or send flows.
- Open Home POS/Gmail alert PRs (#206/#208) are untouched.
