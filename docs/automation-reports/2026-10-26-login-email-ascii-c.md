# MISE-005QP login email ASCII C (2026-10-26)

## Summary

Stop Unicode `.trim()` on the login email/password path from inventing a clean
Auth mailbox via em-space / NBSP padding
(`'\u2003chef@restaurant.com\u2003'.trim() === 'chef@restaurant.com'`).

## Inventing proof

`app/(auth)/login.tsx` Unicode-trimmed and used the trimmed result for continue,
`signInWithPassword`, and the password-step email chip. ASCII C prep (ASCII end
trim only; fail closed when Unicode trim would still strip end padding) leaves
em-space / NBSP alone and softs padded tokens to `""` so the prior
`login.error.emailRequired` branch fires instead of inventing equality with the
clean mailbox.

## Change

- Add `services/domain/loginEmailIdentity.ts`
- Route login continue / sign-in / chip display through `normalizeLoginEmail`
- Leave open accountAuth mailbox tip #722 / MISE-005KS alone (`isValidAccountEmail`
  / `validateSignUpInput` still Unicode-trim on main)
- Leave team-member (#674), beta provisioning (#707), outreach (#420), and
  supplier-recipient (#681) mailbox tips alone

## Verification

- focused AsciiC: 4/4 pass
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles` `withTimeout` hung-promise `cancelledByParent`)
- Docker pgTAP unavailable in this environment

## Merge

Alone-OK with #722. When landing together, keep `loginEmailIdentity.ts`
separate from `normalizeAccountEmail` in `accountAuth.ts`. Do not collapse
login UI prep into the signup validation helper in this tip.
