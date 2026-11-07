# MISE-005ZJ Insights signal presentation.value ASCII C

Date: 2026-11-07  
Branch: `cursor/mise-insights-signal-value-ascii-c`  
Classification: controlled pilot-ready integrity tip (not App Store submission-ready)

## Problem

Insights How Mise knows EvidenceRow always rendered raw `presentation.value`
into the signalValue Text. When a learning-memory signal has no presentation
descriptor, `presentLearningMemorySignal` returns `value: signal.value` as a
raw pass-through of the free-text signal value. Empty / Unicode-only-space
free-text values still produce a non-nullish, truthy signal value (`"\u2003"`),
so blank-looking signal copy appeared on Insights with no intentional localized
none marker. Unicode `.trim()` on a padded free-text value would invent by
stripping trailing Unicode padding before render
(`"\u2003+18%\u2003".trim() === "+18%"`).

## Fix

- Soft-null via `normalizeInsightsSignalValue` in
  `presentationInsightsSignalValueIdentity` (ASCII C single-line: end trim
  only; preserve NBSP; full C0/DEL reject) before the Insights signalValue
  Text render path.
- Soft-null falls through to localized `t("insights.signal.value.none")`
  (EN/ES/zh-Hans).
- Leave Insights signal presentation.label (#1167), presentation.detail
  (#1166), How-Mise-knows memory subtitle `presentLearningMemory(...).label`,
  Task detail operational presentation.title (#1160), and Home HomeTaskRow
  presentation.title (#1162) alone.

## Verification

- focused `tests/insightsSignalValueAsciiC.test.ts` 6/6 (assertion call sites
  counted from source: 82)
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm run design:static`
- `npm test`

## Leave-alone

- `#1167` Insights signal presentation.label
- `#1166` Insights signal presentation.detail
- How-Mise-knows memory subtitle label
- `#1160` Task detail operational presentation.title
- `#1162` Home HomeTaskRow presentation.title
- No migration
