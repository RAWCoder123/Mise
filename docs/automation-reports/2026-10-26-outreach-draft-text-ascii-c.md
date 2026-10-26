# MISE-005QN outreach draft requireBoundedText ASCII C (2026-10-26)

Tip: `cursor/mise-outreach-draft-text-ascii-c`

## Inventing proof

AI `parseOutreachDraft` / `requireBoundedText` Unicode-trimmed subject, body,
and personalization_note and stored the trimmed result
(`'\u2003A simpler prep rhythm\u2003'.trim() === 'A simpler prep rhythm'`,
`'\u00a0Hi team\u00a0'.trim() === 'Hi team'`).

Soft empty / Unicode-only space keeps the prior length-bound error.
Em-space-padded non-empty tokens keep their padding (do not invent equality
with the unpadded draft). NBSP folds to a plain space then C-end-trims.

Open #873 owns domain outreach lead `requireText` only.
Open #724 owns outreach-agent Edge `requireString` only.
Open #420 owns mailbox / `normalizeOutreachEmail`.
None own this AI draft bounded-text identity path.

## Change

- `services/domain/outreachDraftTextIdentity.ts` — NBSP fold + ASCII C end trim
  free-text canonicalize; operator_note multiline control allowlist (TAB/LF/CR)
- Wire `requireBoundedText` in `services/ai/outreachDraft.ts` through
  `normalizeCanonicalOutreachDraftText`
- Leave lead `requireText` (#873), mailbox `normalizeOutreachEmail` (#420),
  greeting `firstName`, and Edge `#724` alone
- Preserve subject single-line header gate and body link rejection

## Merge notes

Alone-OK with #873 / #420 / #724. Keep module separate from
`outreachLeadTextIdentity.ts` and Edge `outreachStringIdentity.ts`.

## Next tip preference

Prefer land/rebase of open stacks #348–#873 (+ this tip) when merge capacity
exists. Next inventing candidates (verify live on main first): pilotReadiness
`sale.item_name.trim()` Set keys; login.tsx email (separate from #722). Do not
retip #873/#872/#871/#870/#869/#868/#867/#866/#420/#724 or this tip.

## Verification

See PR body / commit for focused AsciiC, typecheck, security, and npm test
results.
