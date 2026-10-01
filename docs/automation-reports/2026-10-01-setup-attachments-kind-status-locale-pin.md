# MISE-005EE: pin setup_attachments kind/status CHECKs to COLLATE C

Date: 2026-10-01
Branch: `cursor/mise-setup-attachments-kind-status-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `public.setup_attachments.kind` and `status` allowlists
with the exact-token contracts plus ASCII shape under COLLATE `"C"`:

```sql
kind in ('csv', 'screenshot')
and kind collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'

status in ('queued', 'review_needed', 'processed', 'dismissed')
and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (`setup_persistence_observability` table CHECKs;
`save_restaurant_setup` / atomic setup writers use `csv`/`screenshot` and
`queued`/`review_needed`):

- kind: `csv`, `screenshot`
- status: `queued`, `review_needed`, `processed`, `dismissed`

Exact-token allowlists are preserved; this tip adds the COLLATE C ASCII
shape gate alongside them.

## Why

MISE-005A proved locale drift on this cluster. Open tip #542 pinned pilot
`backend_identity` but left setup attachment vocabulary on bare IN. Without a
dedicated COLLATE C shape CHECK, dump/restore under LC_CTYPE drift can accept
setup-attachment vocabulary bytes the restored C-locale path would refuse —
or the reverse — breaking setup-attachment continuity across restore.

## Scope

- CHECK-only on `public.setup_attachments.kind` and `status`
- Does **not** rewrite `save_restaurant_setup` / atomic setup writers
- Does **not** touch `setup_attachments_metadata_only_check`
- Does **not** rewrite RLS policies
- Does **not** touch pilot vocabulary pins (#542/#541/#536)
- Alone on main OK; timestamp after #542 (`20261001080000`)

## Verification

- `npm run typecheck` pass
- focused `tests/setupAttachmentsKindStatusLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled
- pgTAP fixture committed (plan 17 from 17 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20261001090000_mise_005ee_setup_attachments_kind_status_locale_pin.sql`
- `supabase/tests/database/setup_attachments_kind_status_locale_pin.test.sql`
- `tests/setupAttachmentsKindStatusLocalePin.test.ts`
- `docs/automation-reports/2026-10-01-setup-attachments-kind-status-locale-pin.md`
