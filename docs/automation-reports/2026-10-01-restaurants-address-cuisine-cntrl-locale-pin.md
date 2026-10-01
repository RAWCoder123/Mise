# MISE-005EK restaurants.address / cuisine_type cntrl locale pin

Date: 2026-10-01

## Change

CHECK-only replace of:

- `restaurants_address_length_check` — keep `length(address) <= 500`, add
  `address collate "C" !~ '[[:cntrl:]]'`
- `restaurants_cuisine_type_length_check` — keep `length(cuisine_type) <= 120`,
  add `cuisine_type collate "C" !~ '[[:cntrl:]]'`

Client validators `requireRestaurantAddress` and `requireRestaurantCuisineType`
now reject the same ASCII C control set (`U+0000–U+001F`, `U+007F`) before a
round-trip. Profile patches route address through the new address helper.

## Why

Both length CHECKs had no control-character gate. Address and cuisine_type are
durable restaurant profile fields. Sibling MISE-005 tips pin text CHECKs under
`COLLATE "C"` so dump/restore cannot accept bytes a restored C-locale path
would refuse.

## Out of scope

- `private.update_restaurant_profile` rewrite
- restaurants.name (#548)
- logo_url (#437), service_style (#544), timezone (#462)
- `supplier_orders.operator_note`, `insights_content_bounds`

## Verification

- `npm run typecheck`
- focused `restaurantsAddressCuisineCntrlLocalePin` tests
- `npm test`
- pgTAP plan **15** counted from 15 assertion call sites
