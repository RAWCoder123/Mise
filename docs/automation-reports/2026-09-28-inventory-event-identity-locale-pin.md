# MISE-005BR: pin inventory-event identity CHECKs to COLLATE C

Date: 2026-09-28
Branch: `cursor/mise-inventory-event-identity-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace length-only CHECKs on `public.inventory_events`:

- `client_event_id` → `client_event_id collate "C" ~ '^[A-Za-z0-9:_-]{1,200}$'`
- `idempotency_key` → `idempotency_key collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'`

## Writer vocabulary

Confirmed ASCII mints:

- Device outbox (`services/application/deviceInventoryOutbox.ts`):
  - `clientEventId = createId("inventory_event")` → `inventory_event_<uuid>`
  - `idempotencyKey = inventory:${clientEventId}`
- Count-session approve (`inventory_count_sessions_ledger`):
  - `count_session:` || session_id || `:` || item_id (both columns)
- Demo / fixtures: `demo:…`, `demo_inventory:…`, `device-event-1`,
  `manager-event-1`, `receiving:delivery-1:chicken`

No ISO `.` / `+` tokens are required (unlike supplier_deliveries #458).

## Scope

- CHECK-only; does **not** rewrite `public.record_inventory_event`
- Does **not** touch open #375 oversized-identity trigger, `source` /
  `source_reference`, `activity_events.idempotency_key`, or
  `restaurant_memories.dedupe_key`
- Alone on main OK; timestamp after #477 (`20260928170000`)

## Verification

- `npm run typecheck`
- focused `tests/inventoryEventIdentityLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; Docker/hosted pgTAP not run here

## Files

- `supabase/migrations/20260928170000_mise_005br_inventory_event_identity_locale_pin.sql`
- `supabase/tests/database/inventory_event_identity_locale_pin.test.sql`
- `tests/inventoryEventIdentityLocalePin.test.ts`
- `docs/automation-reports/2026-09-28-inventory-event-identity-locale-pin.md`
