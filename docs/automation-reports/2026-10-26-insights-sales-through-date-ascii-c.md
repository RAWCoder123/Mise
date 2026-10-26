# MISE-005QJ Insights sales throughDate ASCII C (2026-10-26)

Tip: `cursor/mise-insights-sales-through-date-ascii-c`

## Inventing proof

`buildInsightsSalesAnalytics` Unicode-trimmed `input.throughDate` before
using it as the durable analytics window end and deriving `windowStart` /
units-trend calendar keys
(`'\u20032026-08-01\u2003'.trim() === '2026-08-01'`,
`'\u00a02026-08-01\u00a0'.trim() === '2026-08-01'`). Soft empty / unsafe /
Unicode-padded / non-ISO → `null` so callers keep
`|| latestSaleDate(...)` fallthrough.

Open #869 owns Insights sales aggregation labels only.
Open #781 owns Insights sales analytics `restaurantId` only.
Open #740 owns Insights app restaurant workspace.
Open #858 owns purchase-line throw-closed ISO dates.
None own this Insights sales soft throughDate window path.

## Change

- `services/domain/insightsSalesThroughDateIdentity.ts` — ASCII end trim +
  fail-closed canonicalize (real `YYYY-MM-DD` UTC day); soft normalize
- Wired `throughDate` via `normalizeInsightsSalesThroughDate`

## Merge notes

Alone-OK with #869 / #781 / #740 / #858. Keep module separate. Leave
`restaurantId.trim()` and label `normalizeLabel` Unicode trim alone.
When landing with #869, drop #869's assertion that
`input.throughDate?.trim()` still Unicode-trims.

## Verification

- Focused `insightsSalesThroughDateAsciiC` + `insightsSalesAnalytics`: 6/6
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled
  (pre-existing `recalculationCycles` `withTimeout` hung-promise
  `cancelledByParent` on this runner; not introduced by this tip)
- Docker pgTAP unavailable in this environment
