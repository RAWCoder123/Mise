# MISE-005IH: gmail_oauth_flows.failure_code cntrl locale pin

Date: 2026-10-05

## Change

Reattach `private.gmail_oauth_flows.failure_code` CHECK as null OR
`length(failure_code) between 1 and 80` plus
`failure_code collate "C" !~ '[[:cntrl:]]'`.

Preserves the foundation length window. Closes LC_CTYPE dump/restore drift for
private Gmail OAuth failure labels. CHECK-only; alone-OK vs state_hash (#438),
terminal/expiry CHECKs, square_oauth_flows.failure_code (#450 allowlist tip),
and supplier_email_deliveries.last_error_code (#649). Does not expand to the
writer charset allowlist.

## Why

Foundation stored `failure_code` with length-only validation. Writers already
go through `gmail_safe_error_code` or fixed ASCII tokens such as `superseded`,
but dump/restore had no table-level cntrl gate under COLLATE C.

## Verification

- `npm run typecheck`
- focused `gmailOauthFlowsFailureCodeCntrlLocalePin` (3/3)
- `npm test`
- pgTAP fixture committed; plan derived from 12 assertion call sites
