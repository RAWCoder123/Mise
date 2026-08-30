# Daily Brief plan why/effect i18n (2026-08-30)

## Stack
- Base: `origin/main` @ `20b28e5`
- Merged: #260 Daily Brief findings, #275 operating-plan effect, #276 operating-plan why
- Tip: localize Daily Brief `{why}` / `{effect}` interpolations via the same structured presenters as Today

## Closed
- `start_with_task` and `next_readiness_move` presentation descriptors carry `planWhy` / `planEffect` sources
- `presentDailyPhaseFinding` localizes why/effect (and task titles when a source Today task exists) before wrapper templates interpolate
- EN/ES/zh-Hans Daily Brief no longer freezes durable English operating-plan why/effect into morning/pre-service priority findings
- Today timeline shows both localized why and effect on open rows after the #275+#276 merge

## Non-goals
- Freeform recommendation reasons (#270)
- Activity title/summary (#271)
- Land/rebase of older open stacks
- Founder legal URLs / EAS / TestFlight / live POS/Gmail

## Verification
- `npm run typecheck`
- focused dailyPhaseBrief + presentation + why/effect copy tests: 21/21
- `npm test`: 648 pass / 0 fail / 7 cancelled
- `npm run security:static`
