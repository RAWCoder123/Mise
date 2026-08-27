# Home operating-brief domain i18n (2026-08-27)

## Completed

- Structured Home approval/monitoring fields: `source`, `titleIsStructured`,
  `itemName`, `actionType`, `kind`, `subjectName`, `deliveryDate`, `approvalCount`
- Presentation helpers localize recommendation/action templates, pulse summary,
  and monitoring rows in EN / ES / zh-Hans
- Stored tenant prose (`recommendation.reason`, finding explanations, custom
  action titles) stays unchanged
- Home Approvals + status banner use presented copy; Watching section restored
  with localized rows

## Verification

- `npm run typecheck`
- Focused presentation/brief tests: 19/19
- `npm test`: 637 pass / 0 fail / 7 cancellations
- `npm run security:static`
- `npm run security:backend`

## Deferred

- Confidence-rationale fragment localization (still English domain join)
- Inventory coverage-label detail on watching rows
- Compose with open PRs #206–#209 Home banners/evidence on rebase
- Founder legal URLs / EAS / live POS-Gmail
