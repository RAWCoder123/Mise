# MISE-005ZH Insights signal presentation.detail ASCII C

Date: 2026-11-07  
Branch: `cursor/mise-insights-signal-detail-ascii-c`  
Classification: controlled pilot-ready integrity tip (not App Store submission-ready)

## Problem

Insights How Mise knows EvidenceRow always rendered raw `presentation.detail`
into the signalDetail Text. When a learning-memory signal has no presentation
descriptor, `presentLearningMemorySignal` returns
`detail: \`${evidenceLabel}: ${signal.detail}\`` as an evidence-prefixed
pass-through of the free-text signal detail. Empty / Unicode-only-space
free-text details still produce a non-nullish, truthy signal detail
(`"Evidence: \u2003"`), so blank-looking signal copy appeared on Insights with
no intentional localized none marker. Unicode `.trim()` on a padded composed
detail would invent by stripping trailing Unicode padding before render; the
free-text portion alone also invents fully via `.trim()`.

## Fix

- Soft-null via `normalizeInsightsSignalDetail` in
  `presentationInsightsSignalDetailIdentity` (ASCII C single-line: end trim
  only; preserve NBSP; full C0/DEL reject) before the Insights signalDetail
  Text render path.
- Soft-null falls through to localized `t("insights.signal.detail.none")`
  (EN/ES/zh-Hans).
- Leave Insights signal presentation.label / presentation.value, Task detail
  operational presentation.detail (#1165), Operating Plan Timeline a11y
  presentation.detail (#1078), Task detail operational presentation.title
  (#1160), and Restaurant Memory evidence entry.summary (#1154) alone.

## Verification

- focused `tests/insightsSignalDetailAsciiC.test.ts` (assertion call sites
  counted from source: 77)
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm run design:static`
- `npm test`

## Leave-alone

- `#1165` Task detail operational presentation.detail
- `#1078` Operating Plan Timeline a11y presentation.detail
- `#1160` Task detail operational presentation.title
- `#1154` Restaurant Memory evidence entry.summary
- Insights signal `presentation.label` / `presentation.value`
- No migration
