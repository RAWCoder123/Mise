# MISE-005QF Daily Ops askBriefingText ASCII C

Date: 2026-10-25

## Inventing proof

`buildDailyOpsReport` previously Unicode-trimmed Ask Mise `askBriefingText`
before storing the trimmed result on `managerAdvice`. NBSP/em-space padding
invented clean briefing prose
(`'\u2003Confirm walk-in before close\u2003'.trim() === 'Confirm walk-in before close'`).
Soft-empty Unicode-only padding collapsed into the intentional empty omit.

Open #750 owns daily-report restaurant workspace only. It does not own this
Ask Mise briefing free-text selection path. Insight `recommended_action` /
`why_it_matters` Unicode trim inside `pickSignalLine` remains for a sibling tip.

## Change

- `services/domain/dailyOpsAskBriefingIdentity.ts` — NBSP fold + C-end trim
  only; preserve internal LF/TAB/CR; soft empty / unsafe control → null
- Wired `managerAdvice.askBriefingText` in `services/domain/dailyOpsReport.ts`

## Merge notes

Alone-OK with open #750. Keep module separate from restaurant-workspace helpers.
When landing with a future `pickSignalLine` free-text tip, drop this tip's
assertion that insight `recommended_action` / `why_it_matters` still Unicode-trim.

## Verification

- focused AsciiC 4/4
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`
