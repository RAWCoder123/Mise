# MISE-005CF: pin inventory_events.event_type CHECK to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-inventory-event-type-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `inventory_events_event_type_check` on
`public.inventory_events` with the exact-token allowlist plus ASCII shape
under COLLATE `"C"`:

```sql
event_type in (
  'receipt', 'count', 'waste', 'stockout',
  'usage', 'adjustment', 'transfer', 'correction'
)
and event_type collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (same allowlist as `append_inventory_event`):

- `receipt` — received stock / delivery putaway
- `count` — inventory count session apply
- `waste` — waste / spoilage record
- `stockout` — confirmed stockout (quantity zero)
- `usage` — explicit usage / prep consumption
- `adjustment` — manager quantity adjustment
- `transfer` — station / location transfer
- `correction` — superseding ledger correction

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open MISE-005BR (#478) pins
inventory_events identity (`source` / `client_event_id` / `idempotency_key`)
and MISE-005CE (#491) pins sibling `canonical_unit`, but both leave
`event_type` on bare IN only. Without a dedicated COLLATE C shape CHECK,
dump/restore under LC_CTYPE drift can accept ledger-vocabulary bytes the
restored C-locale path would refuse — or the reverse — breaking inventory
event continuity across restore.

## Scope

- CHECK-only on `inventory_events_event_type_check`
- Does **not** rewrite `append_inventory_event` / ledger writers
- Does **not** rewrite `inventory_event_quantity_check` or
  `inventory_event_supersedes_check`
- Does **not** touch inventory_events identity (#478)
- Does **not** touch sibling canonical_unit (#491)
- Does **not** touch `activity_events.event_type`
- Alone on main OK; timestamp after #491 (`20260929180000`)

## Verification

- `npm run typecheck`
- focused `tests/inventoryEventTypeLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; Docker/hosted pgTAP not run here

## Files

- `supabase/migrations/20260929180000_mise_005cf_inventory_event_type_locale_pin.sql`
- `supabase/tests/database/inventory_event_type_locale_pin.test.sql`
- `tests/inventoryEventTypeLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-inventory-event-type-locale-pin.md`
