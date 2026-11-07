# MISE-005ZI Insights signal presentation.label ASCII C

Date: 2026-11-07  
Branch: `cursor/mise-insights-signal-label-ascii-c`  
Classification: controlled pilot-ready integrity tip (not App Store submission-ready)

## Problem

Insights How Mise knows EvidenceRow always rendered raw `presentation.label`
into the signalLabel Text. When a learning-memory signal has no presentation
descriptor, `presentLearningMemorySignal` returns `label: signal.label` as a
raw pass-through of the free-text signal label. Empty / Unicode-only-space
free-text labels still produce a non-nullish, truthy signal label (`"\u2003"`),
so blank-looking signal copy appeared on Insights with no intentional localized
none marker. Unicode `.trim()` on a padded free-text label would invent by
stripping trailing Unicode padding before render
(`"\u2003Friday demand\u2003".trim() === "Friday demand"`).

## Fix

- Soft-null via `normalizeInsightsSignalLabel` in
  `presentationInsightsSignalLabelIdentity` (ASCII C single-line: end trim
  only; preserve NBSP; full C0/DEL reject) before the Insights signalLabel
  Text render path.
- Soft-null falls through to localized `t("insights.signal.label.none")`
  (EN/ES/zh-Hans).
- Leave Insights signal presentation.detail (#1166), presentation.value,
  How-Mise-knows memory subtitle `presentLearningMemory(...).label`, Task
  detail operational presentation.title (#1160), and Home HomeTaskRow
  presentation.title (#1162) alone.

## Verification

- focused `tests/insightsSignalLabelAsciiC.test.ts` (assertion call sites
  counted from source: 78)
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm run design:static`
- `npm test`

## Leave-alone

- `#1166` Insights signal presentation.detail
- Insights signal `presentation.value`
- How-Mise-knows memory subtitle label
- `#1160` Task detail operational presentation.title
- `#1162` Home HomeTaskRow presentation.title
- No migration
