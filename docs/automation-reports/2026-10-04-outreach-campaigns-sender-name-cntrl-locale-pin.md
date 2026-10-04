# MISE-005HM: outreach_campaigns.sender_name cntrl locale pin

## Summary

Additive CHECK-only migration reattaches
`outreach_campaigns_sender_name_check` as
`char_length(btrim(sender_name)) between 1 and 120` plus
`sender_name collate "C" !~ '[[:cntrl:]]'`.

The foundation column was
`sender_name text not null check (char_length(btrim(sender_name)) between 1 and 120)`
with no control-character gate. This tip locks that length bound under
COLLATE "C" so dump/restore cannot accept campaign From-header display-name
bytes a restored C-locale path would refuse.

`sender_name` is classified as a single-line header display name, not
free-form multiline prose. Rejecting LF/TAB/CR/NUL also closes header
injection at the database boundary (Edge already rejects via
`requireHeaderText`).

## Scope

- CHECK-only; does not rewrite outreach writers or Edge Functions
- Leaves campaign `name`, `company_name` (#628), `company_postal_address`,
  `audience_description`, `value_proposition`, sender_email/reply_to (#421),
  timezone (#463), status (#529), and cta_url (#443) untouched
- Alone-OK versus open #421 / #443 / #463 / #529 / #628 and untipped sibling
  campaign text columns on the same table

## Verification

- `npm run typecheck` passed
- focused `outreachCampaignsSenderNameCntrlLocalePin` 4/4 passed
- `npm test` 680 pass / 0 fail / 7 cancelled (pre-existing
  `recalculationCycles` withTimeout hang)
- pgTAP plan 14 from 14 assertion call sites (Docker/pgTAP unavailable
  in this environment)
