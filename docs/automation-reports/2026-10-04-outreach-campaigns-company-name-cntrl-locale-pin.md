# MISE-005HL: outreach_campaigns.company_name cntrl locale pin

## Summary

Additive CHECK-only migration reattaches
`outreach_campaigns_company_name_check` as
`char_length(btrim(company_name)) between 1 and 120` plus
`company_name collate "C" !~ '[[:cntrl:]]'`.

The foundation column was
`company_name text not null default 'Mise' check (char_length(btrim(company_name)) between 1 and 120)`
with no control-character gate. This tip locks that length bound under
COLLATE "C" so dump/restore cannot accept campaign brand-label bytes a
restored C-locale path would refuse.

`company_name` is classified as a single-line brand/org label (default
`Mise`), not free-form multiline prose.

## Scope

- CHECK-only; does not rewrite outreach writers or Edge Functions
- Leaves campaign `name`, `sender_name`, `company_postal_address`,
  `audience_description`, `value_proposition`, sender_email/reply_to (#421),
  timezone (#463), status (#529), and cta_url (#443) untouched
- Alone-OK versus open #421 / #443 / #463 / #529 and untipped sibling
  campaign text columns on the same table

## Verification

- `npm run typecheck` passed
- focused `outreachCampaignsCompanyNameCntrlLocalePin` 4/4 passed
- `npm test` 680 pass / 0 fail / 7 cancelled (pre-existing
  `recalculationCycles` withTimeout hang)
- pgTAP plan 14 from 14 assertion call sites (Docker/pgTAP unavailable
  in this environment)
