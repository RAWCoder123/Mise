# MISE-005IP: outreach_campaigns.cta_url cntrl locale pin

Date: 2026-10-06  
Branch: `cursor/mise-outreach-campaigns-cta-url-cntrl-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.outreach_campaigns.cta_url` remained a protocol-prefix-only CHECK
(`cta_url is null or cta_url ~* '^https?://'`) with no length or
control-character gate. Sibling restaurant `logo_url` tip MISE-005AC (#437)
pins HTTPS host class under COLLATE `"C"`. Under locale drift, dump/restore
can disagree with C-locale URL sibling gates on durable campaign CTA URLs.

## Fix

Additive migration
`20261007020000_mise_005ip_outreach_campaigns_cta_url_cntrl_locale_pin.sql`
reattaches `outreach_campaign_cta_url`:

```sql
cta_url is null
or (
  pg_catalog.length(cta_url) between 1 and 2048
  and cta_url collate "C" !~ '[[:cntrl:]]'
  and cta_url collate "C" ~* '^https?://'
)
```

Preserves the product choice to allow `http://` or `https://` prefixes.
Length class matches restaurant logo_url's 2048 bound.

## Out of scope

- Does not rewrite outreach writers, enrollments, or messages
- Does not tip `outreach_leads.website` (sibling foundation protocol CHECK)
- Does not tighten to HTTPS-only host class (#437 logo_url shape)
- Does not touch other outreach text tips (#628–#648)

## Compose

Alone-OK on main versus logo_url (#437) and outreach text tips. Timestamp
after MISE-005IO (#657).

## Verification

- `npm run typecheck`
- focused `tests/outreachCampaignsCtaUrlCntrlLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed (plan derived from assertion call sites); not
  executed here when Docker unavailable
