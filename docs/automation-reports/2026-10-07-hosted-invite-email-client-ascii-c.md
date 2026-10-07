# MISE-005JM: pin hosted invite email display to ASCII C

Date: 2026-10-07  
Base: `origin/main` @ `78da7376` (MISE-005A)  
Complements: open MISE-005JD (`#674`) team-member email client ASCII C;
open MISE-005AA (`#435`) SQL pin for `find_restaurant_member_candidate`

## Problem

`addRestaurantMemberByEmail` built the optimistic team-row mailbox with
Unicode-aware `trim()` / `toLowerCase()`. The invite lookup path is already
being pinned to ASCII C (`#674` / `#435`). Locale drift lets the repository
invent a Kelvin-folded display mailbox (`K` → `k`) the hosted COLLATE C
candidate lookup would not treat as identical, or strip NBSP that C-locale
`btrim` would preserve.

## Change

- Client-only pin via `services/domain/hostedInviteEmail.ts` (MISE-005JM)
- `addRestaurantMemberByEmail` uses `normalizeHostedInviteEmailDisplay`
- ASCII A–Z case fold + ASCII whitespace trim for invite display email
- Focused static + behavioral tests in
  `tests/hostedInviteEmailClientAsciiC.test.ts`

Does not rewrite membership mutators, list RPCs, or open invite-token stacks.
Does not tip `normalizeTeamMemberEmail` (`#674`) or the SQL candidate lookup
(`#435`). Does not tip demo send From/To (`#425` already owns
`supplierSendContent.ts`).

## Verification

- `npm run typecheck`
- focused `tests/hostedInviteEmailClientAsciiC.test.ts`
- `tests/teamMembership.test.ts`
- `npm test` (when practical)
- `npm run security:static` / `npm run security:backend`
