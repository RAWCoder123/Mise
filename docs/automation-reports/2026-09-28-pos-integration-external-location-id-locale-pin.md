# MISE-005BF: pos_integrations.external_location_id COLLATE C locale pin

Date: 2026-09-28
Branch: `cursor/mise-pos-integration-external-location-id-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Add a nullable ASCII shape CHECK under COLLATE `"C"` on
`public.pos_integrations.external_location_id`:

```text
external_location_id is null
or external_location_id collate "C" ~ '^[A-Za-z0-9_-]{1,128}$'
```

NULL remains valid for disconnected / not-yet-chosen primary location snapshots.
Non-null values must match the same Square-style ASCII class as
`pos_locations.external_location_id` (MISE-005BE / #465).

## Why

The integration row stores the durable primary POS location key used at
connect time. The column had no length or charset CHECK while
`service_complete_square_oauth` writes `nullif(trim(...), '')`. Sibling
`pos_locations.external_location_id` is pinned under COLLATE `"C"` by #465;
without a matching nullable gate on the integration snapshot, dump/restore
under a drifted `LC_CTYPE` could accept a primary identity a restored C-locale
location path would refuse (or the reverse), breaking reconnect continuity.

## Out of scope

- Rewriting `service_complete_square_oauth` (#236 / #460)
- Edge `square-oauth-callback` primary-location filter (#465)
- `_shared/square.ts` allowlist (#460)
- `pos_locations.external_location_id` (#465)
- `pos_sales.provider_location_id` cntrl pin (#417)
- `set_pos_location_status` (#236)
- display_name / timezone free-form fields
- activity_events / restaurant_memories / inventory_events

## Verification

- `npm run typecheck`
- focused: `posIntegrationExternalLocationIdLocalePin`
- `npm test`
- `npm run supabase:test` blocked locally when Docker unavailable
