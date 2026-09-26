# MISE-005AB: restaurant currency + brand/accent color locale pin

Date: 2026-09-26  
Branch: `cursor/mise-restaurant-profile-currency-color-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.restaurants` still stored currency and brand/accent colors under bare
POSIX class CHECKs:

```sql
currency ~ '^[A-Z]{3}$'
brand_color ~ '^#[0-9A-Fa-f]{6}$'
accent_color ~ '^#[0-9A-Fa-f]{6}$'
```

`private.update_restaurant_profile` mirrored those gates with bare
`(p_patch ->> '…') !~ '…'`. POSIX `[A-Z]` / `[0-9A-Fa-f]` follow database
`LC_CTYPE`; MISE-005A proved locale drift on this cluster.

Under ctype drift, dump/restore could reject restaurant rows the source
accepted, and the profile-patch preflight could accept bytes the CHECK would
refuse (or the reverse), breaking branding and currency continuity.

## Fix

Additive migration
`20260926220000_mise_005ab_restaurant_profile_currency_color_locale_pin.sql`:

1. Reattaches the three `restaurants_*` CHECKs with `… collate "C" ~ '…'`.
2. Rewrites `private.update_restaurant_profile` so brand_color, accent_color,
   and currency patch gates use the same `COLLATE "C"` contract.
3. Re-revokes EXECUTE on the private mutator from public/anon/authenticated/
   service_role (public wrapper remains the authenticated entrypoint).

## Out of scope

- Does not rewrite logo_url HTTPS shape or timezone validation
- Does not rewrite `public.update_restaurant_profile` wrapper grants
- Does not pin `purchase_lines.currency` or ingest/append currency gates
  (compose after open #414/#415 / avoid contested MISE-006 append rewrite)

## Compose

Compose-safe alone on main (`private.update_restaurant_profile` unreplaced
since `harden_profile_ai_and_order_boundaries`). Timestamp after MISE-005AA
(#435).

## Verification

- `npm run typecheck`
- focused `tests/restaurantProfileCurrencyColorLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; not executed here (no Docker)
