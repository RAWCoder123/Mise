# Daily Report memory + Ask briefing locale (2026-08-29)

Branch: `cursor/mise-daily-report-memory-locale`
Base: `origin/main` @ `20b28e5`

## Summary

Daily Report was still showing English learning-memory copy and generating the Ask Mise closeout briefing with a hard-coded `en` locale. Insights already localized the same memory codes via `presentLearningMemory`.

## Changes

1. **Pass-through presentation codes** on `DailyOpsReport.learning.memoryPresentation` from `LearningMemorySummary.presentation`.
2. **`presentDailyReportMemory`** presenter reuses `presentLearningMemory` for EN/ES/zh-Hans; raw evidence strings remain when codes are absent.
3. **Daily Report UI** renders presented memory copy / next step.
4. **`fetchDailyOpsReport(restaurantId, { locale })`** builds Ask Mise briefing in the operator locale; screen passes `locale` and reloads on locale change.

## Verification

- `npm run typecheck` passed
- `npm test` — 636 pass / 0 fail / 7 cancelled
- Focused: `dailyReportMemoryLabel`, `dailyReportLocaleWiring`, `dailyOpsReport`, `dailyPhaseBrief`
- `npm run design:static` / `npm run security:static` (see commit notes)

## Non-goals

- Domain memory generation unchanged
- Credibility / manager-advice / empty-signal i18n (open #256–#258)
- Home coverageLabel (#211)
- Phase-brief Ask briefing locale (still defaults to EN until callers pass locale)
