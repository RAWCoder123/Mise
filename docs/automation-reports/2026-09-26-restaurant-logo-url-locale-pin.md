# MISE-005AC: restaurant logo_url HTTPS host class locale pin

Date: 2026-09-26  
Branch: `cursor/mise-restaurant-logo-url-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.restaurants` still stored logo URLs under a bare POSIX class CHECK:

```sql
logo_url ~* '^https://([A-Za-z0-9-]+\.)+[A-Za-z]{2,63}(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
```

`private.update_restaurant_profile` mirrored that gate with bare
`next_logo_url !~* '…'`. POSIX `[A-Za-z0-9-]`, `[A-Za-z]`, and `[[:space:]]`
follow database `LC_CTYPE`; MISE-005A proved locale drift on this cluster.
MISE-005AB (#436) pinned currency and brand/accent hex but intentionally
deferred the logo URL host class.

Under ctype drift, dump/restore could reject restaurant rows the source
accepted, and the profile-patch preflight could accept bytes the CHECK would
refuse (or the reverse), breaking branding continuity.

## Fix

Additive migration
`20260926230000_mise_005ac_restaurant_logo_url_locale_pin.sql`:

1. Reattaches `restaurants_logo_url_check` with `logo_url collate "C" ~* '…'`.
2. Rewrites `private.update_restaurant_profile` so the logo_url patch gate uses
   the same `COLLATE "C"` contract.
3. Re-revokes EXECUTE on the private mutator from public/anon/authenticated/
   service_role (public wrapper remains the authenticated entrypoint).

## Out of scope

- Does not rewrite currency or brand/accent hex (owned by open #436)
- Does not rewrite timezone validation or `public.update_restaurant_profile`
- Does not pin `purchase_lines.currency` or ingest/append currency gates

## Compose

Prefer rebase onto #436 after it lands (shared
`private.update_restaurant_profile`). Alone on main is safe because #436 left
logo_url bare. Timestamp after MISE-005AB (#436).

## Verification

- `npm run typecheck`
- focused `tests/restaurantLogoUrlLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; not executed here (no Docker)
