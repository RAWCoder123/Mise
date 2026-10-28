# MISE-005SK: pin operational-findings evidence summary to ASCII C

Date: 2026-10-28

## Inventing proof

`buildDailyOperationalBrief` Unicode-trimmed and collapsed finding evidence
`summary` through shared `boundedText`
(`.trim().replace(/\s+/g, " ")`) before storing durable
`FindingEvidenceReference.summary`.

```text
'\u2003Chicken Breast\u2003: 38 lb suggested'
  .trim().replace(/\s+/g, " ")
  === 'Chicken Breast : 38 lb suggested'
```

Recommendation and unmapped-sale item-name em-space padding likewise invented a
different durable summary by collapsing mid-string em-spaces into ASCII spaces.
Insight description end-padding invented a clean summary via the same
`boundedText` path.

## Change

- Add `services/domain/operationalFindingsEvidenceSummaryIdentity.ts`
  (NBSP fold + C-locale whitespace collapse + ASCII space trim; soft empty
  fallback; max 240).
- Route recommendation, inventory-item, insight, and unmapped-sale evidence
  `summary` paths in `services/domain/operationalFindings.ts` through
  `boundedCanonicalOperationalFindingsEvidenceSummary`.
- Leave sibling `boundedText` surfaces (`title`, `explanation`,
  `recommendedAction`, confidence `rationale`, unmapped menu-item names) on
  Unicode trim.
- Do not share helpers with #920 title, #921 explanation, #922
  recommendedAction, #755 restaurant workspace, #831 finding-decision evidence
  summary (`operationalFindingEvidenceSummaryIdentity.ts`), or #832
  finding-decision recommended-action.

## Verification

- Focused: `tests/operationalFindingsEvidenceSummaryAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
