# MISE-005SM: pin operational-findings confidence rationale to ASCII C

Date: 2026-10-28  
Base: `origin/main` @ `78da737`

## Finding

Unicode `boundedText` inside `boundedConfidence` invented durable finding
confidence rationales from NBSP/em-space padding
(`'\u2003Current tenant inventory, a verified canonical unit, and a menu mapping support this quantity.\u2003'.trim().replace(/\s+/g, " ") ===
'Current tenant inventory, a verified canonical unit, and a menu mapping support this quantity.'`)
before `OperationalFinding.confidence.rationale` stored the value.

Open operational-findings restaurant workspace tip #755 / MISE-005LY pins only
the entry restaurant id. Finding-decision tips #831 / #832 pin decision evidence
summary and recommended-action in `operationalFindingDecisions.ts`, not brief
confidence rationale. Sibling brief tips #920–#924 pin title, explanation,
recommendedAction, evidence summary, and unmapped menu-item names — not
confidence rationale.

## Change

- Added `services/domain/operationalFindingsConfidenceRationaleIdentity.ts`
  with ASCII C display-prep and soft-fallback rationale bounding
  (empty→fallback, max 180).
- Routed `boundedConfidence` rationale storage through
  `boundedCanonicalOperationalFindingsConfidenceRationale`.
- Left sibling `boundedText` surfaces (title, explanation, recommendedAction,
  evidence summary, unmapped menu-item names) and restaurant workspace
  `.trim()` alone.

## Inventing proof

Prior confidence rationale prep Unicode-trimmed and `\s`-collapsed, then used
the cleaned result. ASCII C prep leaves em-space padding alone and does not
invent equality with the unpadded rationale. Mid-string em-spaces are likewise
preserved instead of collapsing into ASCII spaces.

## Verification

- Focused: `tests/operationalFindingsConfidenceRationaleAsciiC.test.ts` (5/5)
- `npm run typecheck`
- `npm test` (688 total / 688 pass / 0 fail / 0 cancelled; tip +5 vs main ~683)
- `npm run security:static` / `npm run security:backend`

## Do not

- Re-tip this operational-findings confidence rationale path after merge.
- Tip finding-decision evidence summary / recommended-action again (#831/#832).
- Bundle sibling `boundedText` surfaces (title, explanation, recommendedAction,
  evidence summary, unmapped menu-item names) into the same PR — tip one field
  at a time.
- Tip operational-findings restaurant workspace again (#755).
- Share helpers with #920/#921/#922/#923/#924/#755/#831/#832.
