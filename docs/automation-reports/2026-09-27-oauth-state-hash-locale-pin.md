# MISE-005AD: OAuth state_hash + PKCE locale pin (2026-09-27)

## Summary

Gmail and Square OAuth flow tables still validated `state_hash` with bare
`^[0-9a-f]{64}$`, and begin/claim RPCs used the same bare hex class plus bare
`^[A-Za-z0-9._~-]+$` for the PKCE verifier. Under `LC_CTYPE` drift, dump/restore
and reconnect preflights could disagree.

This tip reattaches both `*_oauth_flows_state_hash_check` constraints with
`COLLATE "C"` and rewrites the four private begin/claim RPCs to the same
contract. `service_role` EXECUTE is preserved; public wrappers and complete-oauth
paths are untouched (Gmail complete remains owned by open MISE-005O).

## Files

- `supabase/migrations/20260927000100_mise_005ad_oauth_state_hash_locale_pin.sql`
- `supabase/tests/database/oauth_state_hash_locale_pin.test.sql`
- `tests/oauthStateHashLocalePin.test.ts`

## Verification

- `npm run typecheck`
- focused `tests/oauthStateHashLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; not executed here (no Docker)

## Compose

Compose-safe alone on main after Gmail/Square oauth migrations. Timestamp after
MISE-005AC (#437). Do not stack onto open MISE-005O (complete-oauth only).

## Out of scope

- `gmail_safe_error_code` / Square failure codes
- complete-oauth sender/merchant gates
- Edge Function bodies (already emit lowercase hex + base64url)
- `purchase_lines.currency` and other deferred locale pins
