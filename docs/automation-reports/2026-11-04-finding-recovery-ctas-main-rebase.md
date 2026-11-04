# Finding recovery CTAs — rebased onto main (2026-11-04)

## Summary

Rebases open #306 (`cursor/mise-finding-recovery-ctas`) onto current
`origin/main` (`78da7376`) so Daily Brief findings route managers to existing
fix workflows instead of dead-ending on raw missing-data codes.

**Supersedes** open #306 for this workflow (rebased rather than duplicated).

## Changes

- Presentation-only `presentFindingRecoveryActions` maps missing-data codes,
  typed evidence, and workflow to existing routes
- `DailyBriefBoard` renders up to three recovery buttons; approve/edit/dismiss
  feedback is unchanged
- Missing-data labels localized EN / ES / zh-Hans
- ASCII C harden on recovery tokens: refuse Unicode-trim inventing of known gap
  codes and inventory evidence IDs; soft-null Unicode-padded / empty
  `menu_mapping:` names to the intentional generic mapping label (never invent
  English `menu item`)

## Out of scope

- Inventory / purchasing / finding-decision authority
- Contested inventory/orders mutation screens (navigate only)
- Open purchase-recommendation recovery CTAs (#296)

## Verification

- `npm run typecheck`
- focused `tests/findingRecoveryPresentation.test.ts`
- focused `tests/dailyBriefAndExportUi.test.ts`
- `npm test`
- `npm run security:static`
- `npm run security:backend`

## Classification

Controlled pilot-ready product tip. Not App Store submission-ready.
