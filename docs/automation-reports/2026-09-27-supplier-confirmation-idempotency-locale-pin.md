# MISE-005AY: pin supplier_order_confirmations idempotency_key CHECK to COLLATE C

Date: 2026-09-27  
Branch: `cursor/mise-supplier-confirmation-idempotency-locale-pin`  
Base: `origin/main` @ `78da737`

## Change

Replace the length-only identity CHECK on `public.supplier_order_confirmations`:

| Column | Before | After |
| --- | --- | --- |
| `idempotency_key` | `length(trim(...)) between 1 and 240` | `collate "C" ~ '^[A-Za-z0-9:_+.-]{1,240}$'` |

The charset deliberately includes `.` and `+` so ISO-8601 `recordedAt` mints
(`toISOString()` / offset forms) remain valid inside
`manager_confirmation:mgr-confirm:{orderId}:{stamp}`. The plain ASCII class
used by MISE-005AW would reject those primary manager mints.

## Writer audit

| Path | Mint |
| --- | --- |
| `confirmationClientIdForOrder` (manager confirmation tip) | `mgr-confirm:{orderId}:{recordedAt}` |
| Authenticated `record_supplier_confirmation` | `manager_confirmation:{client_confirmation_id}` |
| Hosted `private.service_record_supplier_confirmation` | stores caller-supplied trimmed key (≤240) |
| Foundation pgTAP fixture | `supplier-confirmation-1` |

Authenticated clients remain SELECT-only on `supplier_order_confirmations`.

## Out of scope

- Rewriting `service_record_supplier_confirmation` or inventory event identity (#375)
- `activity_events.idempotency_key` (ISO / free-form memory labels)
- `restaurant_memories.dedupe_key` (supplier-name legacy keys)
- `supplier_deliveries` identity columns (#458)

## Verification

- `npm run typecheck`
- focused `supplierConfirmationIdempotencyLocalePin` tests
- `npm test`
