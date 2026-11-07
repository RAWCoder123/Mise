# MISE-005ZM Insights memory evidenceNext presentation.nextStep ASCII C

Date: 2026-11-07  
Branch: `cursor/mise-insights-memory-next-step-ascii-c`  
Classification: controlled pilot-ready integrity tip (not App Store submission-ready)

## Problem

Insights How Mise knows expanded evidenceNext always rendered raw
`presentation.nextStep`. When a learning-memory summary has no presentation
descriptor, `presentLearningMemory` returns
`nextStep: \`${copy.evidenceLabel}: ${memory.nextStep}\`` as a raw embedding of
the free-text memory next step. Empty / Unicode-only-space free-text values
still produce a non-nullish, truthy next step (`"Evidence: \u2003"`), so
blank-looking next-step copy appeared inside the How Mise knows expanded body
with no intentional localized none marker. Unicode `.trim()` on a padded
free-text next step embedded into the presentation string would invent by
stripping trailing Unicode padding before render
(`"Evidence: \u2003Keep recording counts.\u2003".trim() ===
"Evidence: \u2003Keep recording counts."`).

## Fix

- Soft-null via `normalizeInsightsMemoryNextStep` in
  `presentationInsightsMemoryNextStepIdentity` (ASCII C single-line: end
  trim only; preserve NBSP; full C0/DEL reject) before the Insights memory
  evidenceNext Text.
- Soft-null falls through to localized `t("insights.memory.nextStep.none")`
  (EN Next step / ES Siguiente / zh-Hans 下一步).
- Leave How-Mise-knows memory subtitle presentation.label (#1169),
  presentation.operatorCopy (#1170), Insights signal presentation.label
  (#1167), presentation.value (#1168), presentation.detail (#1166), Task detail
  operational presentation.title (#1160), and Home HomeTaskRow
  presentation.title (#1162) alone.

## Verification

- focused `tests/insightsMemoryNextStepAsciiC.test.ts` 6/6 (assertion call
  sites counted from source: 96)
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm run design:static`
- `npm test` 689 total / 682 pass / 0 fail / 7 cancelled (pre-existing
  recalculationCycles hung-timeout cancellations; unrelated)

## Leave-alone

- `#1170` How-Mise-knows memory evidenceIntro presentation.operatorCopy
- `#1169` How-Mise-knows memory subtitle presentation.label
- `#1168` Insights signal presentation.value
- `#1167` Insights signal presentation.label
- `#1166` Insights signal presentation.detail
- `#1160` Task detail operational presentation.title
- `#1162` Home HomeTaskRow presentation.title
- No migration
