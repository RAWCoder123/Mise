# Daily Brief Board structured evidence — 2026-11-10

## Completed

- Daily Brief Board finding cards now surface grounded confidence rationale and
  capped evidence summaries already present on `OperationalFinding`.
- Progressive disclosure shows two evidence bullets by default and expands to
  three without inventing additional claims.
- EN / ES / zh-Hans chrome labels added for rationale, checked evidence, and
  show/hide disclosure.
- Pure presentation helper + unit tests keep formatting fail-closed on blank
  summaries or blank rationale.

## Workflows

- Operator opens Today or Insights → Daily Brief Board → reads why confidence
  is what it is and what Mise already checked before approve / edit / dismiss.

## Verification

- `npm run typecheck`
- Focused: `tests/dailyBriefEvidencePresentation.test.ts` +
  `tests/dailyBriefAndExportUi.test.ts`
- Assertion call sites counted from source (presentation + UI pins)

## Alone-OK

- Distinct from Home Approvals structured evidence (#209) and Home Approvals
  ASCII/display tips (#1049 / #1134 / #1135 / #1242).
- Does not wrap Board title / explanation / recommendedAction / workflow /
  compact-preview ASCII tips (#1142–#1147 / #1202).
- Does not change finding-decision authority, recovery CTAs, or receive stacks.

## Not claimed

- Domain English evidence summary strings remain English (chrome labels only).
- Compact-preview a11y and Board `notFound` remain deferred.
- Does not alter recommendation quantities, purchase authority, or send flows.
