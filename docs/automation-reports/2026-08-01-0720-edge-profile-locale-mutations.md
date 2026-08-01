# Edge-route profile and locale mutations (2026-08-01)

## Problem

Authenticated Expo clients could still call Data API RPCs for restaurant profile updates, operator display-name updates, and preferred-locale writes, bypassing `operational-workflows` Edge reservation, rate limiting, and Edge audit logging. `save_restaurant_setup` was already Edge-routed.

## Change

- Migration `20260801072000_edge_profile_and_locale_mutations.sql`:
  - Reparameterizes `private.update_restaurant_profile` with an explicit actor id.
  - Adds service-owned `service_update_restaurant_profile`, `service_update_my_profile`, and `service_update_my_preferred_locale` (`service_role` only).
  - Revokes authenticated execute on the legacy public mutation RPCs.
  - Keeps `get_my_preferred_locale` identity-free for reads.
- Edge `operational-workflows` adds:
  - owner/admin `update_restaurant_profile`
  - staff+ `update_my_profile` and `update_my_preferred_locale` (restaurant id is only for Edge reservation; preference/name rows always use the Edge actor)
- Hosted repository routes the three mutations through Edge; demo paths stay local.
- LocaleProvider builds a session-scoped hosted adapter once a restaurant membership exists.
- pgTAP and static security contracts updated; staging tenant check uses Edge for profile updates.

## Verification

- `npm run typecheck`, `npm test`, `npm run security:backend`, `npm run security:static`, `npm run design:static`, `npm run qa:routes` in this cycle when the environment allows.
- Docker/hosted `verify:private-beta-security` remains blocked here without Docker/staging credentials.
