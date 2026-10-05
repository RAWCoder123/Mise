# MISE-005HZ outreach_leads.fit_notes cntrl locale pin

Date: 2026-10-05

## Change

Additive CHECK-only migration attaches `outreach_leads_fit_notes_check` as:

- `fit_notes is null` OR
- `length(trim(fit_notes)) between 1 and 500` plus
- multiline-aware ASCII control rejection under COLLATE `"C"`:
  `fit_notes collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'`

Allows LF/TAB/CR (same class as `unsafeSupplierSendMultilineControlPattern` /
operator_note / action_outcomes.lesson / outreach_agent_runs.error_summary).
Rejects other C0 controls and DEL.

## Why

Foundation declared nullable text with no CHECK. Domain writers already bound
via `optionalText(..., "fitNotes", 500)` with the multiline-aware control
class. This closes LC_CTYPE dump/restore drift for free-form lead-fit notes
under COLLATE C without blocking legitimate newlines.

## Alone-OK

Leaves business_name (#631), status/contact_basis (#530), email_normalized
(#420), email / source_url / website URL CHECKs, and untipped optional lead
text (`contact_name`, `city`, `state`, `cuisine`) untouched.

## Verification

- `npm run typecheck` — passed
- focused `outreachLeadsFitNotesCntrlLocalePin` — 4/4 passed
- `npm test` — 687 total; 680 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles` timer cancel flake; new tip assertions all pass)
- pgTAP plan **17** counted from 17 assertion call sites (Docker/pgTAP
  unavailable in this environment)
