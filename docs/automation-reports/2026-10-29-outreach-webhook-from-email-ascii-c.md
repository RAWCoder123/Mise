# MISE-005TU outreach-webhook From mailbox ASCII C

Date: 2026-10-29  
Branch: `cursor/mise-outreach-webhook-from-email-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

Edge `outreach-webhook` `extractEmail` Unicode-trimmed non-bracketed From
header values before `normalizeOutreachEmail` and lead `email_normalized`
matching. Em-space / NBSP padding invented a clean durable mailbox
(`'\u2003chef@joescafe.com\u2003'.trim() === 'chef@joescafe.com'`) used by
`stopFollowUpsForReply` to mark leads/enrollments/messages replied.

Open #420 / MISE-005L owns domain `normalizeOutreachEmail` / COLLATE C
`email_normalized`. Open #873 / MISE-005QM owns outreach lead `requireText`.
Open #874 / MISE-005QN owns draft `requireBoundedText`. None owns this
webhook From-header candidate prep.

## Change

- Add `services/domain/outreachWebhookFromEmailIdentity.ts` with ASCII C
  mailbox candidate prep (ASCII end trim only; fail closed when Unicode trim
  would still strip end padding; full C0/DEL control rejection; max 320).
  Email/mailbox tips preserve NBSP as non-space.
- Route `extractEmail` non-bracketed From values through soft-null
  `normalizeOutreachWebhookFromMailbox` so padded From headers cannot invent
  durable reply-stop mailbox identity.
- Leave `normalizeOutreachEmail`, angle-bracket captures, outreach lead text,
  and sibling mailbox tips alone.
- Focused inventing proofs in `tests/outreachWebhookFromEmailAsciiC.test.ts`.

## Verification

- Focused AsciiC: 3/3 pass
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 686 total / 679 pass / 0 fail / 7 cancelled (inherited
  recalculationCycles `withTimeout`); tip +3 vs main ~683
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK with #420 / #873 / #874 / #690 / #681 / #876 / #707. Keep
`outreachWebhookFromEmailIdentity.ts` separate from
`normalizeOutreachEmail` (#420) and outreach lead text (#873). When landing
with #420, resolve textually in `outreach-webhook/index.ts` if both touch
imports — this tip owns only non-bracketed From candidate prep.
