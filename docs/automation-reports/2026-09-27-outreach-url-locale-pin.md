# MISE-005AI: pin outreach HTTP(S) URL CHECKs to COLLATE C

Date: 2026-09-27  
Branch: `cursor/mise-outreach-url-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.outreach_campaigns.cta_url` and `public.outreach_leads.source_url` /
`website` still validate with bare `~* '^https?://'`. Case-insensitive regex
matching follows database `LC_CTYPE` for case folding. MISE-005A proved locale
drift on this cluster; MISE-005L/M pinned outreach email shapes with
`COLLATE "C"` but deferred these literal-prefix URL gates.

These URLs are restore authority for commercial CTA destinations and lead
provenance. If `LC_CTYPE` drifted under bare `~*`, `pg_dump`/`restore` could
reject campaign or lead rows the source accepted.

## Change

- Additive migration `20260927060000_mise_005ai_outreach_url_locale_pin.sql`
  - Reattach `outreach_campaign_cta_url`, `outreach_leads_source_url_check`,
    and `outreach_lead_website_url` with
    `<column> collate "C" ~* '^https?://'`
- Domain `matchesOutreachHttpUrlPrefix` / `OUTREACH_HTTP_URL_PREFIX` documents
  ASCII C case-fold parity with the CHECK
- `requireHttpUrl` and outreach-agent `optionalHttpUrl` fail closed on that
  shared prefix before the stricter URL parse
- Source-pin + pgTAP fixtures committed

Does **not** touch sender/reply email CHECKs (open MISE-005M #421),
lead/suppression `email_normalized` (open MISE-005L #420), or rewrite Edge
auth/service gates beyond the shared prefix helper.

## Verification

- `npm run typecheck`
- focused `tests/outreachUrlLocalePin.test.ts`
- `npm test`
- pgTAP committed; Docker/pgTAP unavailable in this environment

## Out of scope

- Landing/rebasing open stacks #348–#442
- `ingest_purchase_lines` document_reference cntrl (needs #414/#415)
- `purchase_lines.currency` COLLATE C (needs #414/#415)
- Invite email pin (needs #235)
- `realtime.to_regrole` audit
- Inventing MOQ / lead_time / expiration
