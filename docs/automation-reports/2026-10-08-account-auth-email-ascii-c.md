# MISE-005KS: pin accountAuth mailbox identity to ASCII C

Date: 2026-10-08  
Base: `origin/main` @ `78da7376` (MISE-005A)  
Complements: open team-member email client ASCII C (`#674`), beta provisioning
email (`#707`), outreach email (`#420`), supplier-recipient email (`#681`)

## Problem

`isValidAccountEmail` / `validateSignUpInput` in `services/domain/accountAuth.ts`
used Unicode-aware `trim()` and a `\s`-based mailbox shape on the account
admission path. Locale drift lets Kelvin sign `K` fold to `k` when a caller
canonicalizes with Unicode `toLowerCase`, inventing an ordinary ASCII mailbox
(`Khef@…` → `chef@…`). Unicode `\s` also treats NBSP as a mailbox separator
while C-locale `[[:space:]]` does not, and Unicode `trim()` invents a clean
mailbox from NBSP / em-space padding around an otherwise-valid address.

Invite-only beta admission currently disables self-serve signup, but this
domain helper remains the account mailbox identity gate for validation tests
and any future Auth wiring.

## Change

- Client-only pin in `services/domain/accountAuth.ts` (MISE-005KS)
- Export `normalizeAccountEmail` with ASCII A–Z case fold + ASCII whitespace trim
- ASCII mailbox shape (no Unicode `\s`) + ASCII control rejection
- `isValidAccountEmail` delegates to `normalizeAccountEmail`
- `validateSignUpInput` emptiness check uses ASCII C trim
- Focused static + behavioral tests in `tests/accountAuthEmailAsciiC.test.ts`

Does not rewrite invite-callback parsing, password rules, team-member invite
(`#674`), beta provisioning (`#707`), or Edge `isCanonicalEmail` reject-non-lower.

## Verification

- `npm run typecheck`
- focused `tests/accountAuthEmailAsciiC.test.ts` + `tests/accountAuth.test.ts`
- `npm test` (when practical)
- `npm run security:static` / `npm run security:backend`

## Product note

Controlled pilot-ready codebase. This hardens account mailbox identity on the
Auth domain helper; it does not unblock Apple signing, live POS credentials, or
App Store submission.
