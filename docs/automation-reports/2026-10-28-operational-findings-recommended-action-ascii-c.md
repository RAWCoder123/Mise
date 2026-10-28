# MISE-005SJ: pin operational-findings recommendedAction to ASCII C

Date: 2026-10-28

## Inventing proof

`buildDailyOperationalBrief` Unicode-trimmed and collapsed finding
`recommendedAction` through shared `boundedText`
(`.trim().replace(/\s+/g, " ")`) before storing durable
`OperationalFinding.recommendedAction` and unreviewed
`managerFeedback.effectiveRecommendedAction`.

```text
'\u2003Review the latest produce receipt before the next order.\u2003'
  .trim().replace(/\s+/g, " ")
  === 'Review the latest produce receipt before the next order.'
```

Recommendation supplier-name padding likewise invented a clean action string
via the template that fed `boundedText`.

## Change

- Add `services/domain/operationalFindingsRecommendedActionIdentity.ts`
  (NBSP fold + C-locale whitespace collapse + ASCII space trim; soft empty
  fallback; max 240).
- Route recommendation and insight `recommendedAction` paths in
  `services/domain/operationalFindings.ts` through
  `boundedCanonicalOperationalFindingsRecommendedAction`.
- Leave sibling `boundedText` surfaces (`title`, `explanation`, evidence
  `summary`, confidence `rationale`, unmapped menu-item names) on Unicode trim.
- Do not share helpers with #920 title, #921 explanation, #755 restaurant
  workspace, #831 finding-decision evidence summary, or #832 finding-decision
  recommended-action (`operationalFindingRecommendedActionIdentity.ts`).

## Verification

- Focused: `tests/operationalFindingsRecommendedActionAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
