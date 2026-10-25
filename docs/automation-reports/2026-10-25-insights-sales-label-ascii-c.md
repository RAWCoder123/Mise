# MISE-005QI Insights sales aggregation label ASCII C

Date: 2026-10-25  
Branch: `cursor/mise-insights-sales-label-ascii-c`

## Inventing proof

`buildInsightsSalesAnalytics` previously Unicode-trimmed POS `item_name`,
`category`, and `source_pos` tokens before collapsing whitespace and using
the result as durable best-seller / mix aggregation Map keys:

```text
'\u2003Chicken Bowl\u2003'.trim() === 'Chicken Bowl'
```

That invents parallel Insights aggregation identities before ranking and
mix share calculation.

Open #781 / MISE-005MY owns Insights sales analytics `restaurantId` only.
Open #740 / MISE-005LJ owns the Insights app restaurant workspace path.
Open #677 / MISE-005JH owns operationalSignals demand-key identity.
Open #704 / MISE-005KI owns miseDomain insight demand slugs. None of those
own this Insights sales aggregation-label path.

## Change

- `services/domain/insightsSalesLabelIdentity.ts` — ASCII-only end trim +
  ASCII internal whitespace collapse + fail-closed canonicalize; soft
  normalize for default-label fallthrough
- Wired `normalizeLabel` in `services/domain/insightsSalesAnalytics.ts`
  through `normalizeInsightsSalesLabel`
- Soft empty / Unicode-padded / control / non-string → `""` so callers keep
  `|| "Uncategorized" | "POS" | "Item"` fallthrough (prior helper never
  threw on a bad label)

## Alone-OK merge notes

Alone-OK with #781 / #740 / #677 / #704. Keep
`insightsSalesLabelIdentity.ts` separate. Leave `restaurantId.trim()` and
`throughDate?.trim()` Unicode trim on their existing contracts. When
landing with #781, drop any #781 assertion that `normalizeLabel` still
Unicode-trims.

## Verification

- focused `tests/insightsSalesLabelAsciiC.test.ts` — 4/4
- related `tests/insightsSalesAnalytics.test.ts` — 2/2
- `npm run typecheck` — pass
- `npm run security:static` / `npm run security:backend` — pass
- `npm test` — 687 total / 680 pass / 0 fail / 7 cancelled (pre-existing
  `recalculationCycles` `withTimeout` hung-promise `cancelledByParent` on this
  runner; not introduced by this tip)
- Docker pgTAP unavailable in this environment
