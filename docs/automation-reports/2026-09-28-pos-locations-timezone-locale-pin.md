# MISE-005BO: pos_locations.timezone IANA locale pin

Date: 2026-09-28  
Branch: `cursor/mise-pos-location-timezone-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.pos_locations.timezone` was unbound nullable text. Square OAuth
completion stores provider location clocks via
`nullif(left(coalesce(...), 64), '')`, and the Edge locations mapper accepts
any string of length ≤ 64. The column anchors POS location time math (sale
date attribution, sync windows).

Under LC_CTYPE drift, dump/restore can disagree on the same timezone bytes —
accepting a row a restored C-locale gate would refuse (or the reverse),
breaking POS location clock continuity across restore. Sibling
`restaurants.timezone` (MISE-005BB #462) and `outreach_campaigns.timezone`
(MISE-005BC #463) were pinned under COLLATE `"C"`; `pos_locations.timezone`
stayed unbound.

## Fix

Additive migration
`20260928140000_mise_005bo_pos_locations_timezone_locale_pin.sql`
adds `pos_locations_timezone_check`:

```sql
timezone is null
or (
  timezone collate "C" ~ '^[A-Za-z0-9/_+-]{1,64}$'
)
```

Same IANA Area/Location ASCII class as restaurants / outreach; length 1–64
matches the Square writer `left(..., 64)` bound. NULL remains allowed when the
provider omits a timezone.

## Out of scope

- Does not rewrite `service_complete_square_oauth` or Square sync writers
  (contested with open #236 / #460 / #465 location stacks)
- Does not rewrite `_shared/square.ts` length-only timezone mapper (follow-up
  after those stacks land)
- Does not touch `restaurants.timezone` (#462) or `outreach_campaigns.timezone`
  (#463)
- Does not touch `external_location_id` (#465 / #466) or free-form
  `display_name`

## Compose

Compose-safe alone on main. Timestamp after MISE-005BN (#474). Prefer landing
after nearby timezone / POS identity pins so restore continuity for location
clocks is uniform; this tip does not depend on them.

## Verification

- `npm run typecheck` — pass
- focused `tests/posLocationsTimezoneLocalePin.test.ts` — 5/5
- `npm test` — 681 pass / 0 fail / 7 cancelled (withTimeout baseline)
- pgTAP fixture committed; not executed here when Docker unavailable
