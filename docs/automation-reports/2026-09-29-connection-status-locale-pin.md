# MISE-005CN: pin POS and email connection status CHECKs to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-connection-status-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `pos_integrations.status` and
`restaurant_email_connections.status` allowlists with the exact-token contract
plus ASCII shape under COLLATE `"C"`:

```sql
-- POS
status in ('not_connected', 'connected', 'paused', 'error')
and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'

-- Email
status in ('not_connected', 'connected', 'needs_reauth', 'restricted')
and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (`services/miseValidation.ts`, demo/hosted repositories,
OAuth fail RPCs):

- POS: `not_connected`, `connected`, `paused`, `error`
- Email: `not_connected`, `connected`, `needs_reauth`, `restricted`

Exact-token allowlists are preserved; this tip adds the COLLATE C ASCII shape
gate alongside them.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pins cover POS
identity and sync cursor (#466/#473) and Gmail subject (#464), but leave
connection status on bare IN only. Without a dedicated COLLATE C shape CHECK,
dump/restore under LC_CTYPE drift can accept connection-lifecycle bytes the
restored C-locale path would refuse — or the reverse — breaking reconnect and
readiness continuity across restore.

## Scope

- CHECK-only on `public.pos_integrations.status` and
  `public.restaurant_email_connections.status`
- Does **not** rewrite OAuth fail/complete RPCs
- Does **not** touch sync_cursor (#473), external_location_id (#466), or
  Gmail provider_subject (#464)
- Does **not** touch `restaurant_tasks.status` (#498),
  `supplier_orders.status` (#497), or `recalculation_runs` pins (#496/#499)
- Alone on main OK; timestamp after #499 (`20260930020000`)

## Verification

- `npm run typecheck`
- focused `tests/connectionStatusLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed (plan 22 from 22 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930020000_mise_005cn_connection_status_locale_pin.sql`
- `supabase/tests/database/connection_status_locale_pin.test.sql`
- `tests/connectionStatusLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-connection-status-locale-pin.md`
