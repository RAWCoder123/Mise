# MISE-005CI: pin inventory_count_sessions.status CHECK to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-inventory-count-sessions-status-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `inventory_count_sessions.status` allowlist
(`in_progress` / `submitted` / `approved` / `cancelled`) with the exact-token
contract plus ASCII shape under COLLATE `"C"`:

```sql
status in ('in_progress', 'submitted', 'approved', 'cancelled')
and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint:

- `in_progress` — open count session, lines still editable
- `submitted` — count submitted for manager review
- `approved` — manager approved; count events applied to ledger
- `cancelled` — session abandoned without applying counts

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pins cover
`recipe_versions.status` (#494), verification_status (#493),
`inventory_events.event_type` (#492), and canonical_unit (#490/#491), but leave
`inventory_count_sessions.status` on bare IN only. Without a dedicated COLLATE
C shape CHECK, dump/restore under LC_CTYPE drift can accept count-session
lifecycle bytes the restored C-locale path would refuse — or the reverse —
breaking count-session authority continuity across restore.

## Scope

- CHECK-only on `public.inventory_count_sessions.status`
- Does **not** rewrite count begin/submit/approve/cancel writers
- Does **not** touch consistency timestamp CHECKs
  (`inventory_count_sessions_submitted_consistency`,
  `inventory_count_sessions_approved_consistency`,
  `inventory_count_sessions_cancelled_consistency`)
- Does **not** touch `recipe_versions.status` (#494), verification_status
  (#493), `inventory_events.event_type` (#492), or canonical_unit pins
  (#490/#491)
- Alone on main OK; timestamp after #494 (`20260929210000`)

## Verification

- `npm run typecheck`
- focused `tests/inventoryCountSessionsStatusLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed (plan 12 from 12 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260929210000_mise_005ci_inventory_count_sessions_status_locale_pin.sql`
- `supabase/tests/database/inventory_count_sessions_status_locale_pin.test.sql`
- `tests/inventoryCountSessionsStatusLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-inventory-count-sessions-status-locale-pin.md`
