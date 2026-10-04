# MISE-005HO: outreach_leads.business_name cntrl locale pin

## Summary

Additive CHECK-only migration reattaches
`outreach_leads_business_name_check` as
`char_length(btrim(business_name)) between 1 and 160` plus
`business_name collate "C" !~ '[[:cntrl:]]'`.

The foundation column was
`business_name text not null check (char_length(btrim(business_name)) between 1 and 160)`
with no control-character gate. This tip locks that length bound under
COLLATE "C" so dump/restore cannot accept business-name bytes a restored
C-locale path would refuse.

`business_name` is classified as a single-line lead business title, not
free-form multiline prose. Rejecting LF/TAB/CR/NUL keeps titles stable
across restore and blocks control-character injection at the database
boundary.

## Scope

- CHECK-only; does not rewrite outreach writers or Edge Functions
- Leaves `status` / `contact_basis` (#530), `email_normalized` uniqueness
  (#420), email / source_url / website URL CHECKs, and untipped optional
  lead text columns (`contact_name`, `city`, `state`, `cuisine`,
  `fit_notes`) untouched
- Alone-OK versus open #420 / #530 / #531 and untipped sibling lead text
  columns on the same table

## Verification

- `npm run typecheck` passed
- focused `outreachLeadsBusinessNameCntrlLocalePin` 4/4 passed
- `npm test` 680 pass / 0 fail / 7 cancelled (pre-existing
  `recalculationCycles` withTimeout hang)
- pgTAP plan 14 from 14 assertion call sites (Docker/pgTAP unavailable
  in this environment)
