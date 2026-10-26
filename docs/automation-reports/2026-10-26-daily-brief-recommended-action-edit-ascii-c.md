# MISE-005QX Daily Brief recommended-action edit ASCII C

Date: 2026-10-26  
Branch: `cursor/mise-daily-brief-recommended-action-edit-ascii-c`

## Inventing proof

`components/dailyBrief/DailyBriefBoard.tsx` save-edit previously Unicode-trimmed
the operator edit and the current `finding.recommendedAction` before the
emptiness / unchanged / max-320 gates and the `submit("edited", next)` payload:

```text
'\u2003Order chicken before lunch service.\u2003'.trim()
  === 'Order chicken before lunch service.'
```

NBSP / em-space padding therefore invented equality with a clean free-text
recommended action before finding-decision feedback stored the edit.

## Change

- `services/domain/dailyBriefRecommendedActionEditIdentity.ts` — ASCII C
  multiline free-text prep + soft normalize for Daily Brief save-edit
- Wire `DailyBriefBoard` save-edit through
  `normalizeDailyBriefRecommendedActionEdit`
- Leave open domain recommended-action tip (#832 / MISE-005OX), evidence
  summary (#831), Approve / Dismiss, and SQL cntrl pins (#620 / #621) alone

## Alone-OK merge notes

Alone-OK with open #832 / #831 / #883 / #620 / #621. Keep
`dailyBriefRecommendedActionEditIdentity.ts` separate from
`operationalFindingRecommendedActionIdentity.ts`. When landing with #832, drop
this tip's assertion that `operationalFindingDecisions.ts` still routes through
`requireBoundedText` once #832 owns those helpers.

## Verification

- focused `tests/dailyBriefRecommendedActionEditAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`
