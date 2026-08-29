# Daily Report advice / credibility / empty-signal i18n

Branch: `cursor/mise-daily-report-advice-i18n`
Base: `origin/main` @ `20b28e5`

## Implementation
- `services/presentation/dailyReportAdviceLabel.ts` — localize known manager-advice title/detail templates from `rankManagerActions` / `buildTodaySummary` (stock risk, pending orders, open work, all-clear, inventory alerts, suggested order, stable item). Unknown insight titles/details render as-is.
- `services/presentation/credibilityLabel.ts` — localize exact `buildCredibilitySummary` label and next-step strings.
- `services/presentation/dailyReportSignalLine.ts` — localize exact empty `No {type} signal for closeout.` lines; insight-derived lines pass through.
- `app/more/daily-report.tsx` — wire presenters for signals, learning, and manager advice.
- Catalog keys EN/ES/zh-Hans under `dailyReport.advice.*`, `dailyReport.learning.credibility.*`, `dailyReport.learning.nextStep.*`, `dailyReport.signal.empty.*`.

## Verification
- `npm run typecheck`
- `node --test --import tsx tests/dailyReportAdviceLabel.test.ts`
- `npm test`
- `npm run design:static`
- `npm run security:static`

## Non-goals
- Domain string generation unchanged.
- Insight-authored freeform titles/details and learning memory copy remain as-is (no invented facts).
- Orthogonal to open #256 miseStatus and #257 operatingSummary.
