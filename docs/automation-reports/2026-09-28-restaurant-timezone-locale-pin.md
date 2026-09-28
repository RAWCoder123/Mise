# MISE-005BB: restaurants.timezone CHECK locale pin

Date: 2026-09-28  
Branch: `cursor/mise-restaurant-timezone-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.restaurants.timezone` still only enforced length 1–64. Client and
`private.update_restaurant_profile` already require a real IANA name, but the
table CHECK admitted any Unicode string of that length — including ASCII
controls and spaced labels.

Under `LC_CTYPE` drift, dump/restore and profile-patch continuity can disagree
on the same timezone bytes. Restaurant timezone anchors count boundaries,
planning snapshots, POS sale-date attribution, and Today service windows.

## Fix

Additive migration
`20260928010000_mise_005bb_restaurant_timezone_locale_pin.sql` reattaches
`restaurants_timezone_length_check`:

```sql
timezone collate "C" ~ '^[A-Za-z0-9/_+-]{1,64}$'
```

Client `requireIanaTimezone` now fail-closes on the same ASCII class via
exported `isIanaTimezoneShape` / `IANA_TIMEZONE_SHAPE_PATTERN` before the Intl
lookup.

## Out of scope

- Does **not** rewrite `private.update_restaurant_profile` (open #436 / #437)
- Does **not** rewrite `create_restaurant_with_owner` (default `America/New_York`)
- Does **not** pin `outreach_campaigns.timezone`
- Does **not** rewrite currency / brand / accent / logo_url CHECKs

## Compose

Compose-safe alone on main. Prefer after MISE-005AB/005AC (#436/#437) land so a
follow-up can pin the writer `pg_timezone_names` compare to COLLATE C without
rewriting the contested profile function twice. Timestamp after MISE-005BA
(#461).

## Verification

- `npm run typecheck`
- focused `tests/restaurantTimezoneLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; not executed here (no Docker)
