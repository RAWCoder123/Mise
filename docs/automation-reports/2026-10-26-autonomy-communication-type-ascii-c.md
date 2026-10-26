# MISE-005QQ autonomy communicationType ASCII C (2026-10-26)

## Summary

Stop Unicode `.trim()` on the Autonomy Settings communication-channel save path
from inventing a clean channel label via em-space / NBSP padding
(`'\u2003email\u2003'.trim() === 'email'`).

## Inventing proof

`app/settings/autonomy.tsx` Unicode-trimmed `draft.communicationType` and used
the trimmed result (or null) for `saveAutonomyRule`. ASCII C prep (ASCII end
trim only; fail closed when Unicode trim would still strip end padding) leaves
em-space / NBSP alone and softs padded tokens to `null` so the prior
`.trim() || null` contract holds instead of inventing equality with the clean
channel label. Length stays capped at 80 to align with open SQL tip #614 /
MISE-005GX.

## Change

- Add `services/domain/autonomyCommunicationTypeIdentity.ts`
- Route Autonomy Settings save through `normalizeAutonomyCommunicationType`
- Leave open autonomy restaurant-workspace tip #741 / MISE-005LK alone
- Leave `normalizeTime` and spend-limit draft prep on this screen alone
- Do not add or rewrite the SQL communication_type CHECK (#614)

## Verification

- focused AsciiC: 4/4 pass
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles` `withTimeout` hung-promise `cancelledByParent`)
- Docker pgTAP unavailable in this environment

## Merge

Alone-OK with #741 / #614. Keep `autonomyCommunicationTypeIdentity.ts` separate
from application `autonomy.ts` restaurant-workspace trim. Do not collapse this
UI prep into the SQL migration tip.
