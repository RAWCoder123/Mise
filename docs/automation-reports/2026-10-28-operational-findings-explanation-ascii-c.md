# MISE-005SI: pin operational-findings explanation to ASCII C

Date: 2026-10-28  
Base: `origin/main` @ `78da737`

## Finding

Unicode `boundedText` inside `buildDailyOperationalBrief` invented durable
finding explanations from NBSP/em-space padding
(`'\u2003Chicken Breast has less than one service day of projected coverage.\u2003'
.trim().replace(/\s+/g, " ") ===
'Chicken Breast has less than one service day of projected coverage.'`) before
`OperationalFinding.explanation` stored the value.

Open operational-findings title tip #920 / MISE-005SH pins only finding titles.
Restaurant workspace tip #755 / MISE-005LY pins only the entry restaurant id.
Finding-decision tips #831 / #832 pin decision evidence summary and
recommended-action in `operationalFindingDecisions.ts`, not brief explanations.

## Change

- Added `services/domain/operationalFindingsExplanationIdentity.ts` with ASCII C
  display-prep and soft-fallback explanation bounding (empty→fallback, max 240).
- Routed recommendation and insight finding `explanation` call sites through
  `boundedCanonicalOperationalFindingsExplanation`.
- Left sibling `boundedText` surfaces (title, recommendedAction, evidence
  summary, confidence rationale, unmapped menu-item names) and restaurant
  workspace `.trim()` alone.

## Inventing proof

Prior explanation prep Unicode-trimmed and `\s`-collapsed, then used the cleaned
result. ASCII C prep leaves em-space padding alone and does not invent equality
with the unpadded explanation.

## Verification

- Focused: `tests/operationalFindingsExplanationAsciiC.test.ts` (5/5)
- `npm run typecheck`
- `npm test` (688 total / 681 pass / 0 fail / 7 cancelled; tip +5 vs main ~683; inherited recalculationCycles cancellations OK)
- `npm run security:static` / `npm run security:backend`

## Do not

- Re-tip this operational-findings explanation path after merge.
- Tip finding-decision evidence summary / recommended-action again (#831/#832).
- Bundle sibling `boundedText` surfaces (title, recommendedAction, evidence
  summary, rationale) into the same PR — tip one field at a time.
- Tip operational-findings title again (#920) or restaurant workspace again (#755).
