# MISE-005IQ: outreach_leads.website cntrl locale pin

Date: 2026-10-06  
Branch: `cursor/mise-outreach-leads-website-cntrl-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.outreach_leads.website` remained a protocol-prefix-only CHECK
(`website is null or website ~* '^https?://'`) with no length or
control-character gate. Sibling campaign `cta_url` tip MISE-005IP (#658)
upgrades the same foundation pattern to length 1..2048 + cntrl +
`https?://` under COLLATE `"C"`. Open MISE-005AI (#443) only re-pins the
bare protocol under COLLATE `"C"` without length/cntrl. Under locale drift,
dump/restore can disagree with C-locale URL sibling gates on durable lead
website URLs.

## Fix

Additive migration
`20261007030000_mise_005iq_outreach_leads_website_cntrl_locale_pin.sql`
reattaches `outreach_lead_website_url`:

```sql
website is null
or (
  pg_catalog.length(website) between 1 and 2048
  and website collate "C" !~ '[[:cntrl:]]'
  and website collate "C" ~* '^https?://'
)
```

Preserves the product choice to allow `http://` or `https://` prefixes.
Length class matches restaurant logo_url / campaign cta_url's 2048 bound.

## Out of scope

- Does not rewrite outreach writers, enrollments, or messages
- Does not tip `outreach_leads.source_url` (sibling foundation protocol CHECK)
- Does not tip `outreach_campaigns.cta_url` (#658)
- Does not tighten to HTTPS-only host class (#437 logo_url shape)
- Does not touch other outreach text tips (#628–#648)

## Compose

Alone-OK on main versus logo_url (#437), cta_url (#658), and outreach text
tips. Supersedes #443's website-only protocol re-pin when either lands.
Timestamp after MISE-005IP (#658).

## Verification

- `npm run typecheck`
- focused `tests/outreachLeadsWebsiteCntrlLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed (plan derived from assertion call sites); not
  executed here when Docker unavailable
