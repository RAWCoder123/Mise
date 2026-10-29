# MISE-005TV outreach greeting firstName ASCII C

Date: 2026-10-29

## Inventing proof

Prior domain `buildFallbackOutreachDraft` greeting `firstName` Unicode-trimmed
the contact name before taking the first whitespace token for the durable
fallback draft body:

```text
('\u2003' + 'Alex Rivera' + '\u2003').trim().split(/\s+/)[0]
  === 'Alex'
→ baked into `Hi Alex,` in deterministic outreach draft text

('\u00a0' + 'Alex Rivera' + '\u00a0').trim().split(/\s+/)[0]
  === 'Alex'
→ same inventing via NBSP padding
```

Soft empty / Unicode-only space also collapsed through `.trim()` into the
intentional `"there"` fallback.

Not owned by open #873 (lead `requireText`, which explicitly left greeting
`firstName` alone), #874 (draft `requireBoundedText`), #420
(`normalizeOutreachEmail`), #849 (user profile display name), or Home / Ask
Mise presentation name splits.

## Fix

New `services/domain/outreachGreetingFirstNameIdentity.ts`:

- ASCII-end-trims only
- fail-closes (soft-null) when Unicode padding remains, controls appear, or
  the value is non-string
- preserves soft-empty / fail-closed tokens as null so the live
  `|| "there"` branch owns the intentional greeting fallback without
  inventing a clean first-name token from padding
- keeps the prior 80-character first-token cap

Wired only into domain `firstName` used by `buildFallbackOutreachDraft`.
Left `normalizeOutreachEmail`, `requireText` / `optionalText`, AI draft
bounded text, and Home / Ask Mise presentation greetings alone.

Do **not** share this module with:

- #873 / MISE-005QM `outreachLeadTextIdentity`
- #874 / MISE-005QN `outreachDraftTextIdentity`
- #420 mailbox `normalizeOutreachEmail`
- #959 / MISE-005TU outreach-webhook From mailbox identity
- #849 / MISE-005PO user profile display name
- Home / Ask Mise presentation `firstName` splits

When landing with #873, drop #873's cross-assertion that `firstName` still
Unicode-trims; keep `outreachGreetingFirstNameIdentity.ts` separate from
`outreachLeadTextIdentity.ts`.

## Verification

- focused AsciiC tests
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
