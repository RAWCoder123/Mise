# MISE-005IB: outreach_leads.city cntrl locale pin

## Summary

Additive CHECK-only migration attaches
`outreach_leads_city_check` as
`city is null or (length(trim(city)) between 1 and 120 and
city collate "C" !~ '[[:cntrl:]]')`.

The foundation column was unbound nullable `city text` with no
length or control-character gate. Domain writers already bound via
`optionalText(input.city, "city", 120)`. This tip locks that
bound under COLLATE "C" so dump/restore cannot accept city bytes a
restored C-locale path would refuse.

`city` is classified as a single-line lead locality label,
not free-form multiline prose. Rejecting LF/TAB/CR/NUL keeps locality
labels stable across restore and blocks control-character injection at
the database boundary.

## Scope

- CHECK-only; does not rewrite outreach writers or Edge Functions
- Leaves `business_name` (#631), `contact_name` (#643), `fit_notes`
  (#642), `status` / `contact_basis` (#530), `email_normalized`
  uniqueness (#420), email / source_url / website URL CHECKs, and
  untipped optional lead text (`state`, `cuisine`) untouched
- Alone-OK versus open #420 / #530 / #631 / #642 / #643 and untipped
  sibling lead text columns on the same table

## Verification

- `npm run typecheck` passed
- focused `outreachLeadsCityCntrlLocalePin` 4/4 passed
- `npm test` 687 total / 680 pass / 0 fail / 7 cancelled (pre-existing
  `recalculationCycles` withTimeout hang)
- pgTAP plan 16 from 16 assertion call sites (Docker/pgTAP unavailable
  in this environment)
