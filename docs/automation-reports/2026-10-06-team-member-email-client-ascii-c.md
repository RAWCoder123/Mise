# MISE-005JD: pin team-member email client normalize to ASCII C

Date: 2026-10-06  
Base: `origin/main` @ `78da7376` (MISE-005A)  
Complements: open MISE-005AA (`#435`) SQL pin for `find_restaurant_member_candidate`

## Problem

`normalizeTeamMemberEmail` used Unicode-aware `trim()` / `toLowerCase()` and a
`\s`-based mailbox shape. On the same invite path, MISE-005AA pins the hosted
RPC to `lower(btrim(...) COLLATE "C")` plus C-locale `[[:cntrl:]]` /
`[[:space:]]` gates. Locale drift lets the client invent a Kelvin-folded
mailbox (`K` → `k`) that the COLLATE C lookup would not match, or accept
control bytes the server rejects.

## Change

- Client-only pin in `services/domain/teamMembership.ts`
- ASCII A–Z case fold only (`asciiCLower`)
- ASCII whitespace trim (no Unicode `trim`)
- Explicit ASCII control rejection (0x00–0x1F, DEL)
- Mailbox shape uses ASCII whitespace class, not `\s`
- Focused static + behavioral tests in
  `tests/teamMemberEmailClientAsciiC.test.ts`

Does not rewrite membership mutators, list RPCs, or open invite-token stacks.
Does not add a migration (SQL pin remains `#435`).

## Verification

- `npm run typecheck`
- focused `tests/teamMemberEmailClientAsciiC.test.ts`
- `tests/teamMembership.test.ts`
- `npm test` (when practical)
- `npm run security:static` / `npm run security:backend`
