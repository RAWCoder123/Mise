# MISE-005IR: outreach_leads.source_url cntrl locale pin

Date: 2026-10-06  
Branch: `cursor/mise-outreach-leads-source-url-cntrl-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.outreach_leads.source_url` remained a NOT NULL protocol-prefix-only
CHECK (`source_url ~* '^https?://'`) with no length or control-character
gate. Sibling campaign `cta_url` tip MISE-005IP (#658) and lead `website`
tip MISE-005IQ (#659) upgrade the same foundation pattern to length
1..2048 + cntrl + `https?://` under COLLATE `"C"`. Open MISE-005AI (#443)
only re-pins the bare protocol under COLLATE `"C"` without length/cntrl.
Under locale drift, dump/restore can disagree with C-locale URL sibling
gates on durable lead provenance URLs.

## Fix

Additive migration
`20261007040000_mise_005ir_outreach_leads_source_url_cntrl_locale_pin.sql`
reattaches `outreach_leads_source_url_check`:

```sql
pg_catalog.length(source_url) between 1 and 2048
and source_url collate "C" !~ '[[:cntrl:]]'
and source_url collate "C" ~* '^https?://'
```

No null OR — column is NOT NULL. Preserves the product choice to allow
`http://` or `https://` prefixes. Length class matches restaurant logo_url
/ campaign cta_url / lead website's 2048 bound.

## Out of scope

- Does not rewrite outreach writers, enrollments, or messages
- Does not tip `outreach_leads.website` (#659)
- Does not tip `outreach_campaigns.cta_url` (#658)
- Does not tighten to HTTPS-only host class (#437 logo_url shape)
- Does not touch other outreach text tips (#628–#648)

## Compose

Alone-OK on main versus logo_url (#437), cta_url (#658), website (#659),
and outreach text tips. Supersedes #443's source_url-only protocol re-pin
when either lands. Timestamp after MISE-005IQ (#659).

## Verification

- `npm run typecheck`
- focused `tests/outreachLeadsSourceUrlCntrlLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed (plan derived from assertion call sites); not
  executed here when Docker unavailable
