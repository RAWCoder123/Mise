# MISE-005BE: pos_locations.external_location_id COLLATE C locale pin

Date: 2026-09-28
Branch: `cursor/mise-pos-location-external-id-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Add an ASCII shape CHECK under COLLATE `"C"` on
`public.pos_locations.external_location_id`:

```text
external_location_id collate "C" ~ '^[A-Za-z0-9_-]{1,128}$'
```

Edge `square-oauth-callback` filters location payloads through local
`isSquareExternalLocationId` / `SQUARE_EXTERNAL_LOCATION_ID_PATTERN` before the
complete RPC. If Square returned locations but none survive the ASCII gate,
OAuth fails closed with `token_response_invalid` and security event
`square_oauth_location_id_invalid`.

## Why

`external_location_id` is the durable POS location key for sync filters,
recipe-mapping joins, and purchase-authority location resolution. The column
had uniqueness only—no length or charset CHECK—while writers truncated with
`left(..., 128)`. Sale-side `provider_location_id` already carries a length +
cntrl bound; without a matching location-row gate, dump/restore under a drifted
`LC_CTYPE` could accept identities a restored C-locale path would refuse (or
the reverse), breaking location continuity.

## Out of scope

- Rewriting `service_complete_square_oauth` (#236 / #460)
- `set_pos_location_status` (#236)
- `pos_sales.provider_location_id` cntrl pin (#417)
- `_shared/square.ts` allowlist (#460 owns that file for merchant_id)
- `pos_integrations.external_location_id` nullable snapshot
- display_name / timezone free-form fields
- activity_events / restaurant_memories / inventory_events

## Verification

- `npm run typecheck`
- focused: `posLocationExternalIdLocalePin`
- `npm test`
- `npm run supabase:test` blocked locally when Docker unavailable
