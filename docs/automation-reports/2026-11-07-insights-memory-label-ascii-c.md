# MISE-005ZK Insights memory subtitle presentation.label ASCII C

Date: 2026-11-07  
Branch: `cursor/mise-insights-memory-label-ascii-c`  
Classification: controlled pilot-ready integrity tip (not App Store submission-ready)

## Problem

Insights How Mise knows subtitle always interpolated raw `presentation.label`
into `t("insights.memory.subtitle", { label: presentation.label, ... })`.
When a learning-memory summary has no presentation descriptor,
`presentLearningMemory` returns `label: memory.label` as a raw pass-through of
the free-text memory label. Empty / Unicode-only-space free-text values still
produce a non-nullish, truthy memory label (`"\u2003"`), so blank-looking label
copy appeared inside the How Mise knows subtitle with no intentional localized
none marker. Unicode `.trim()` on a padded free-text label would invent by
stripping trailing Unicode padding before interpolation
(`"\u2003Mise memory is reliable\u2003".trim() === "Mise memory is reliable"`).

## Fix

- Soft-null via `normalizeInsightsMemoryLabel` in
  `presentationInsightsMemoryLabelIdentity` (ASCII C single-line: end trim
  only; preserve NBSP; full C0/DEL reject) before the Insights memory subtitle
  `label` interpolation.
- Soft-null falls through to localized `t("insights.memory.label.none")`
  (EN/ES/zh-Hans).
- Leave Insights signal presentation.label (#1167), presentation.value
  (#1168), presentation.detail (#1166), Task detail operational
  presentation.title (#1160), and Home HomeTaskRow presentation.title (#1162)
  alone.

## Verification

- focused `tests/insightsMemoryLabelAsciiC.test.ts` 6/6 (assertion call sites
  counted from source: 86)
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm run design:static`
- `npm test`

## Leave-alone

- `#1168` Insights signal presentation.value
- `#1167` Insights signal presentation.label
- `#1166` Insights signal presentation.detail
- `#1160` Task detail operational presentation.title
- `#1162` Home HomeTaskRow presentation.title
- No migration
