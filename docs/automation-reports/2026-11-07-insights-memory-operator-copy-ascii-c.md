# MISE-005ZL Insights memory evidenceIntro presentation.operatorCopy ASCII C

Date: 2026-11-07  
Branch: `cursor/mise-insights-memory-operator-copy-ascii-c`  
Classification: controlled pilot-ready integrity tip (not App Store submission-ready)

## Problem

Insights How Mise knows expanded evidenceIntro always rendered raw
`presentation.operatorCopy`. When a learning-memory summary has no presentation
descriptor, `presentLearningMemory` returns `operatorCopy: memory.operatorCopy`
as a raw pass-through of the free-text memory operator copy. Empty /
Unicode-only-space free-text values still produce a non-nullish, truthy operator
copy (`"\u2003"`), so blank-looking intro copy appeared inside the How Mise
knows expanded body with no intentional localized none marker. Unicode `.trim()`
on a padded free-text operator copy would invent by stripping trailing Unicode
padding before render
(`"\u2003Recipe baselines give Mise enough evidence.\u2003".trim() ===
"Recipe baselines give Mise enough evidence."`).

## Fix

- Soft-null via `normalizeInsightsMemoryOperatorCopy` in
  `presentationInsightsMemoryOperatorCopyIdentity` (ASCII C single-line: end
  trim only; preserve NBSP; full C0/DEL reject) before the Insights memory
  evidenceIntro Text.
- Soft-null falls through to localized `t("insights.memory.copy.none")`
  (EN Summary / ES Resumen / zh-Hans 摘要).
- Leave How-Mise-knows memory subtitle presentation.label (#1169),
  presentation.nextStep, Insights signal presentation.label (#1167),
  presentation.value (#1168), presentation.detail (#1166), Task detail
  operational presentation.title (#1160), and Home HomeTaskRow
  presentation.title (#1162) alone.

## Verification

- focused `tests/insightsMemoryOperatorCopyAsciiC.test.ts` 6/6 (assertion call
  sites counted from source: 92)
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm run design:static`
- `npm test` 689 total / 682 pass / 0 fail / 7 cancelled (pre-existing
  recalculationCycles hung-timeout cancellations; unrelated)

## Leave-alone

- `#1169` How-Mise-knows memory subtitle presentation.label
- How-Mise-knows presentation.nextStep (distinct later tip if inventing proven)
- `#1168` Insights signal presentation.value
- `#1167` Insights signal presentation.label
- `#1166` Insights signal presentation.detail
- `#1160` Task detail operational presentation.title
- `#1162` Home HomeTaskRow presentation.title
- No migration
