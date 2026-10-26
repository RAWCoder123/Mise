# MISE-005QR autonomy allowed-window time ASCII C (2026-10-26)

## Summary

Stop Unicode `.trim()` on the Autonomy Settings allowedStartTime / allowedEndTime
save path from inventing a clean clock via em-space / NBSP padding
(`'\u200309:00\u2003'.trim() === '09:00'` → `'09:00:00'`).

## Inventing proof

`app/settings/autonomy.tsx` previously Unicode-trimmed draft allowed-window
times inside local `normalizeTime` before the `HH:MM(:SS)` gate and save.
ASCII C prep (ASCII end trim only; fail closed when Unicode trim would still
strip end padding) leaves em-space / NBSP alone and softs padded tokens to
`null` so the prior emptiness contract holds instead of inventing equality
with the clean allowed-window clock. Valid `HH:MM` values still expand to
`HH:MM:00`.

## Change

- Add `services/domain/autonomyAllowedTimeIdentity.ts`
- Route Autonomy Settings save through `normalizeAutonomyAllowedTime`
- Remove local Unicode-trim `normalizeTime`
- Leave open autonomy restaurant-workspace tip #741 / MISE-005LK alone
- Leave communicationType draft prep on this screen alone (open #877 / MISE-005QQ)
- Leave spend-limit draft prep alone

## Verification

- focused AsciiC: 4/4 pass
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles` `withTimeout` hung-promise `cancelledByParent`)
- Docker pgTAP unavailable in this environment

## Merge

Alone-OK with #741 / #877. Keep `autonomyAllowedTimeIdentity.ts` separate from
application `autonomy.ts` restaurant-workspace trim and from
`autonomyCommunicationTypeIdentity.ts`. When landing with #877, drop #877's
assertion that local `normalizeTime` remains Unicode-trim on this screen.
