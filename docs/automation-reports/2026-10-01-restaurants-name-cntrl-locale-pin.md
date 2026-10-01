# MISE-005EJ restaurants.name cntrl locale pin

Date: 2026-10-01

## Change

CHECK-only replace of `restaurants_name_length_check`:

- keep length `btrim(name)` between 1 and 120
- reject ASCII controls with `name collate "C" !~ '[[:cntrl:]]'`

Client `requireRestaurantName` now rejects the same ASCII C control set
(`U+0000–U+001F`, `U+007F`) before a round-trip.

## Why

The length CHECK had no control-character gate. Restaurant name is durable
tenant identity. Sibling MISE-005 tips pin text CHECKs under `COLLATE "C"` so
dump/restore cannot accept bytes a restored C-locale path would refuse.

## Out of scope

- `private.create_restaurant_with_owner` rewrite
- address / cuisine / logo_url CHECKs
- `service_style` (#544), timezone (#462)

## Verification

- `npm run typecheck`
- focused `restaurantsNameCntrlLocalePin` tests
- `npm test`
- pgTAP plan **11** counted from 11 assertion call sites
