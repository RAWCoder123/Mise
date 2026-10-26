# MISE-005QS Ask Mise question ASCII C (2026-10-26)

## Summary

Stop Unicode `.trim()` on the Ask Mise chat send path from inventing a clean
operator question via em-space / NBSP padding
(`'\u2003What stock is low?\u2003'.trim() === 'What stock is low?'`).

## Inventing proof

`app/ask-mise.tsx` Unicode-trimmed the operator question and used the trimmed
result for emptiness checks, chat transcript storage, and `answerAskMise`.
ASCII C free-text prep (NBSP fold + C-end trim only; preserve internal LF/TAB/CR)
leaves em-space padding alone so equality with a clean question cannot be
invented. Soft empty / Unicode-only space softs to `null` so the prior ask
early-return still fires.

Open #700 / MISE-005KE owns Ask Mise intent-classify ASCII C case fold /
haystack only. Open #866 owns Daily Ops `askBriefingText` projection. Open #849
owns user profile display-name. None own this interactive Ask Mise question
path.

## Change

- Add `services/domain/askMiseQuestionIdentity.ts`
- Route Ask Mise chat `ask()` through `normalizeAskMiseQuestion`
- Leave open intent-classify tip #700 on its existing
  `question.trim().toLowerCase()` contract
- Leave greeting `user?.name?.trim()` and send-button emptiness-only
  `input.trim()` checks alone

## Verification

- focused AsciiC: 4/4 pass
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles` `withTimeout` hung-promise `cancelledByParent`)
- Docker pgTAP unavailable in this environment

## Merge

Alone-OK with #700 / #866 / #849. Keep `askMiseQuestionIdentity.ts` separate
from `askMiseIntentHaystack` / `normalizeAskMiseIntentToken` in #700 and from
`dailyOpsAskBriefingIdentity.ts` in #866. When landing with #700, drop this
tip's assertion that `classifyAskMiseIntent` still Unicode-trims once that tip
owns the haystack.
