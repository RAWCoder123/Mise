# MISE-005EI: pin pos_integrations.authority_sync_mode CHECK to COLLATE C

Date: 2026-10-01
Branch: `cursor/mise-pos-authority-sync-mode-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace `pos_integrations_authority_sync_state_check` so the active-lease
branch keeps the exact `full` / `partial` allowlist and adds ASCII shape
under COLLATE `"C"`:

```sql
authority_sync_mode in ('full', 'partial')
and authority_sync_mode collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

Idle-all-null and active-lease window / location-id semantics are unchanged.

## Writer vocabulary

Confirmed ASCII mint (`private.begin_square_authority_sync` /
`private.complete_square_authority_sync` in MISE-003A correction):

- `full` — may attest the exact current 28-day purchasing window
- `partial` — always invalidates purchasing completeness

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling POS tips #473
(sync_cursor), #476 (sync_cursor writer cntrl), #465
(pos_locations.external_location_id), #523 (connection provider), and #500
(connection status) leave `authority_sync_mode` on bare IN inside the
compound state CHECK. Without a dedicated COLLATE C shape gate,
dump/restore under LC_CTYPE drift can accept sync-mode bytes the restored
C-locale path would refuse — or the reverse — breaking purchase-authority
sync continuity across restore.

## Scope

- CHECK-only on `public.pos_integrations` authority sync state constraint
- Does **not** rewrite prepare/apply Square sync writers (#429)
- Does **not** touch sync_cursor (#473/#476), external_location_id
  (#465), connection provider (#523), or connection status (#500)
- Alone on main OK; timestamp after #546 (`20261001120000`)

## Verification

- `npm run typecheck` pass
- focused `tests/posAuthoritySyncModeLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (inherited cancelledByParent noise; new
  MISE-005EI cases pass)
- pgTAP fixture committed (plan **11** from 11 assertion call sites); Docker
  hosted pgTAP not run here

## Files

- `supabase/migrations/20261001130000_mise_005ei_pos_authority_sync_mode_locale_pin.sql`
- `supabase/tests/database/pos_authority_sync_mode_locale_pin.test.sql`
- `tests/posAuthoritySyncModeLocalePin.test.ts`
- `docs/automation-reports/2026-10-01-pos-authority-sync-mode-locale-pin.md`
