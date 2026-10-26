# MISE-005QM outreach lead text ASCII C (2026-10-26)

Tip: `cursor/mise-outreach-lead-text-ascii-c`

## Inventing proof

Domain `normalizeOutreachLead` / `requireText` Unicode-trimmed lead text
fields and stored the trimmed result
(`'\u2003Harbor Grill\u2003'.trim() === 'Harbor Grill'`,
`'\u00a0Newark\u00a0'.trim() === 'Newark'`).

Soft empty / Unicode-only space keeps the prior length-bound error.
Unicode-padded non-empty tokens fail closed (`${fieldName} is required.`)
rather than inventing equality with the unpadded label.

Open #724 owns outreach-agent Edge `requireString` only.
Open #420 owns mailbox / `normalizeOutreachEmail` SQL+client fold guidance.
Open #631 / #643–#646 / #642 own outreach_leads.*.cntrl SQL CHECKs.
None own this domain `requireText` identity path.

## Change

- `services/domain/outreachLeadTextIdentity.ts` — ASCII end trim +
  fail-closed canonicalize; preserve prior control allowlist (TAB/LF/CR)
- Wire `requireText` in `services/domain/outreach.ts` through
  `normalizeCanonicalOutreachLeadText`
- Leave `normalizeOutreachEmail`, `firstName`, and
  `services/ai/outreachDraft.ts` `requireBoundedText` alone

## Merge notes

Alone-OK with #420 / #724 / #631 / #643–#646 / #642. Keep module separate.
Do not fold mailbox normalize or greeting `firstName` into this tip.

## Verification

- focused `outreachLeadTextAsciiC`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
