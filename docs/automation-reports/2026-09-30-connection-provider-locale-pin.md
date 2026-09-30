# MISE-005DK: pin connection provider CHECKs to COLLATE C

Date: 2026-09-30
Branch: `cursor/mise-connection-provider-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `pos_integrations.provider` and
`restaurant_email_connections.provider` allowlists with exact-token
contracts plus ASCII shape under COLLATE `"C"`:

```sql
-- POS
provider in ('square', 'toast', 'clover', 'lightspeed', 'manual_csv', 'demo')
and provider collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'

-- Email
provider in ('gmail')
and provider collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (restaurant-ops backbone / email scaffolding create-table
allowlists, `supabase/functions/_shared/mise.ts` `PosProvider`, and Gmail OAuth
writers):

- POS: `square` / `toast` / `clover` / `lightspeed` / `manual_csv` / `demo`
- Email: `gmail`

Exact-token allowlists are preserved; this tip adds the COLLATE C ASCII shape
gate alongside them.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pin #500 covers
connection **status** only and leaves provider columns on bare IN. Without a
dedicated COLLATE C shape CHECK, dump/restore under LC_CTYPE drift can accept
provider-identity bytes the restored C-locale path would refuse — or the
reverse — breaking reconnect and provider routing continuity across restore.

## Scope

- CHECK-only on `public.pos_integrations.provider` and
  `public.restaurant_email_connections.provider`
- Does **not** rewrite OAuth fail/complete RPCs
- Does **not** touch connection status (#500), sync_cursor (#473),
  external_location_id (#466), or provider_subject (#464)
- Alone on main OK; timestamp after #522 (`20260930250000`)

## Verification

- `npm run typecheck` pass
- focused `tests/connectionProviderLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (inherited cancelledByParent noise; new
  MISE-005DK cases pass)
- pgTAP fixture committed (plan 23 from 23 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930250000_mise_005dk_connection_provider_locale_pin.sql`
- `supabase/tests/database/connection_provider_locale_pin.test.sql`
- `tests/connectionProviderLocalePin.test.ts`
- `docs/automation-reports/2026-09-30-connection-provider-locale-pin.md`
