# MISE-005SH: pin operational-findings title to ASCII C

Date: 2026-10-28  
Base: `origin/main` @ `78da737`

## Finding

Unicode `boundedText` inside `buildDailyOperationalBrief` invented durable
finding titles from NBSP/em-space padding
(`'\u2003Review chicken coverage\u2003'.trim().replace(/\s+/g, " ") ===
'Review chicken coverage'`) before `OperationalFinding.title` stored the value.

Open operational-findings restaurant workspace tip #755 / MISE-005LY pins only
the entry restaurant id. Finding-decision tips #831 / #832 pin decision evidence
summary and recommended-action in `operationalFindingDecisions.ts`, not brief
titles.

## Change

- Added `services/domain/operationalFindingsTitleIdentity.ts` with ASCII C
  display-prep and soft-fallback title bounding (empty→fallback, max 120).
- Routed recommendation and insight finding `title` call sites through
  `boundedCanonicalOperationalFindingsTitle`.
- Left sibling `boundedText` surfaces (explanation, recommendedAction, evidence
  summary, confidence rationale, unmapped menu-item names) and restaurant
  workspace `.trim()` alone.

## Inventing proof

Prior title prep Unicode-trimmed and `\s`-collapsed, then used the cleaned
result. ASCII C prep leaves em-space padding alone and does not invent equality
with the unpadded title.

## Verification

- Focused: `tests/operationalFindingsTitleAsciiC.test.ts` (5/5)
- `npm run typecheck`
- `npm test` (688 total / 681 pass / 0 fail / 7 cancelled; tip +5 vs main ~683; inherited recalculationCycles cancellations OK)
- `npm run security:static` / `npm run security:backend`

## Do not

- Re-tip this operational-findings title path after merge.
- Tip finding-decision evidence summary / recommended-action again (#831/#832).
- Bundle sibling `boundedText` surfaces (explanation, recommendedAction,
  evidence summary, rationale) into the same PR — tip one field at a time.
- Tip operational-findings restaurant workspace again (#755).
