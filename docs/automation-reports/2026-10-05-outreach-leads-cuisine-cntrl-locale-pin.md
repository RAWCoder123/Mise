# MISE-005ID: outreach_leads.cuisine cntrl locale pin

## Summary

Additive CHECK-only migration attaches
`outreach_leads_cuisine_check` as
`cuisine is null or (length(trim(cuisine)) between 1 and 120 and
cuisine collate "C" !~ '[[:cntrl:]]')`.

The foundation column was unbound nullable `cuisine text` with no
length or control-character gate. Domain writers already bound via
`optionalText(input.cuisine, "cuisine", 120)`. This tip locks that
bound under COLLATE "C" so dump/restore cannot accept cuisine bytes a
restored C-locale path would refuse.

`cuisine` is classified as a single-line lead cuisine label,
not free-form multiline prose. Rejecting LF/TAB/CR/NUL keeps cuisine
labels stable across restore and blocks control-character injection at
the database boundary.

## Scope

- CHECK-only; does not rewrite outreach writers or Edge Functions
- Leaves `business_name` (#631), `contact_name` (#643), `fit_notes`
  (#642), `city` (#644), `state` (#645), `status` / `contact_basis`
  (#530), `email_normalized` uniqueness (#420), and email / source_url /
  website URL CHECKs untouched
- Alone-OK versus open #420 / #530 / #631 / #642 / #643 / #644 / #645

## Verification

- `npm run typecheck` passed
- focused `outreachLeadsCuisineCntrlLocalePin` 4/4 passed
- `npm test` 687 total / 680 pass / 0 fail / 7 cancelled (pre-existing
  `recalculationCycles` withTimeout hang)
- pgTAP plan 16 from 16 assertion call sites (Docker/pgTAP unavailable
  in this environment)
