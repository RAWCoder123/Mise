# MISE-005KL: pin beta provisioning email identity to ASCII C

Date: 2026-10-08  
Base: `origin/main` @ `78da7376` (MISE-005A)  
Complements: open MISE-005IN (`#656`) beta provisioning name/cuisine cntrl CHECKs

## Problem

`normalizeProvisioningRequest` used Unicode-aware `trim()` / `toLowerCase()` and a
`\s`-based mailbox shape on the invite-only beta owner provisioning path. The
operator Auth lookup helpers in `beta-restaurant-provisioning.mjs` and
`staging-owner-invitation-check.mjs` compared mailboxes the same way.

Unicode case folding invents an ordinary ASCII owner mailbox from a Kelvin-sign
lookalike (`toKen@…` → `token@…`). That can reserve, invite, or match the wrong
Auth user before the replay-safe provisioning RPC runs. Unicode `\s` also treats
NBSP as a mailbox separator while C-locale `[[:space:]]` does not.

## Change

- Shared ASCII C helpers in `scripts/lib/betaRestaurantProvisioning.mjs` (MISE-005KL)
- Owner email + hex idempotency key normalize through ASCII A–Z fold and ASCII whitespace trim
- Mailbox shape uses an explicit ASCII whitespace class (not `\s`)
- Operator and staging Auth lookups compare through `provisioningEmailsMatch`
- Focused static + behavioral tests in `tests/betaProvisioningEmailAsciiC.test.ts`

Does not add a migration (name/cuisine SQL pins remain `#656`). Does not rewrite
supplier-recipient, outreach, team-member, or hosted-invite email tips.

## Verification

- `npm run typecheck`
- focused `tests/betaProvisioningEmailAsciiC.test.ts`
- `tests/betaRestaurantProvisioning.test.ts`
- `npm test` (when practical)
- `npm run security:static` / `npm run security:backend`
