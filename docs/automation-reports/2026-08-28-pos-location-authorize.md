# POS location authorize / pause (2026-08-28)

## Completed
- Owner/admin RPC `set_pos_location_status` toggles Square `pos_locations` between `active` and `paused`.
- Settings → POS lists locations when Square is connected; Pause / Authorize controls.
- OAuth reconnect preserves paused locations (disconnected restores to active).
- Sync continues to use `status = 'active'` only; Data API remains SELECT-only on `pos_locations`.
- EN / ES / zh-Hans copy; pilot role matrix + gap audit updated.

## Verification
- `npm run typecheck`
- `npm test` (includes `tests/posLocationAuthorization.test.ts`)
- `npm run security:backend` / `npm run security:static`

## Still blocked / deferred
- Invite-gated Auth signup (depends on #235 landing)
- Hosted migration deploy + Docker pgTAP for `pos_location_authorization.test.sql`
- Live multi-location Square merchant proof
