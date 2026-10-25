# MISE-005QG Daily Ops pickSignalLine insight free-text ASCII C

Date: 2026-10-25

## Inventing proof

`pickSignalLine` previously Unicode-trimmed insight `recommended_action` and
`why_it_matters` before composing the Daily Ops closeout signal line.
NBSP/em-space padding invented clean operator-facing prose
(`'\u2003Special the herbs tonight\u2003'.trim() === 'Special the herbs tonight'`).
Soft-empty Unicode-only padding collapsed into the intentional falsy fallthrough
(why → description → title).

Open #866 owns Daily Ops Ask Mise `askBriefingText` only. Open #832 owns finding
`recommendedAction`, not Daily Ops insight `recommended_action` /
`why_it_matters` inside `pickSignalLine`. Neither owns this signal-line path.

## Change

- `services/domain/dailyOpsSignalLineIdentity.ts` — NBSP fold + C-end trim only;
  preserve internal LF/TAB/CR; soft empty / unsafe control → null
- Wired `pickSignalLine` insight `recommended_action` / `why_it_matters` in
  `services/domain/dailyOpsReport.ts`

## Merge notes

Alone-OK with open #866 / #832 / #750. Keep module separate. When landing with
#866, drop #866's assertion that insight `recommended_action` /
`why_it_matters` still Unicode-trim, and drop this tip's assertion that
`askBriefingText` still Unicode-trims.

## Verification

- focused AsciiC 4/4
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`
