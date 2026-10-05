# MISE-005HR: outreach_campaigns.value_proposition cntrl locale pin

## Summary

Additive CHECK-only migration reattaches
`outreach_campaigns_value_proposition_check` as
`char_length(btrim(value_proposition)) between 1 and 800` plus
multiline-aware ASCII control rejection under COLLATE `"C"`:

`value_proposition collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'`

The foundation column was
`value_proposition text not null check (char_length(btrim(value_proposition)) between 1 and 800)`
with no control-character gate. This tip locks that length bound under
COLLATE `"C"` so dump/restore cannot accept value-proposition bytes a restored
C-locale path would refuse.

`value_proposition` is classified as free-form multiline campaign messaging
prose, not a single-line title. The tip allows LF/TAB/CR (same class as
`unsafeSupplierSendMultilineControlPattern` / operator_note #551 /
order_message #619 / lesson #618 / company_postal_address #632 /
audience_description #633) and rejects other C0 controls and DEL.

## Scope

- CHECK-only; does not rewrite outreach writers or Edge Functions
- Leaves campaign `name` (#630), `company_name` (#628), `sender_name` (#629),
  `company_postal_address` (#632), `audience_description` (#633),
  sender_email/reply_to (#421), timezone (#463), status (#529), and cta_url
  (#443) untouched
- Alone-OK versus open #628 / #629 / #630 / #631 / #632 / #633 and untipped
  sibling campaign prose columns on the same table

## Verification

- `npm run typecheck` — passed
- focused `outreachCampaignsValuePropositionCntrlLocalePin` — 4/4 passed
- `npm test` — 687 pass / 0 fail / 0 cancelled
- pgTAP plan **16** counted from 16 assertion call sites (Docker/pgTAP
  unavailable in this environment)
