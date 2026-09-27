# MISE-005AX: pin supplier_deliveries identity CHECKs to COLLATE C

Date: 2026-09-27  
Branch: `cursor/mise-supplier-delivery-identity-locale-pin`  
Base: `origin/main` @ `78da737`

## Change

Replace length-only identity CHECKs on `public.supplier_deliveries`:

| Column | Before | After |
| --- | --- | --- |
| `client_delivery_id` | `length(trim(...)) between 1 and 200` | `collate "C" ~ '^[A-Za-z0-9:_+.-]{1,200}$'` |
| `idempotency_key` | `length(trim(...)) between 1 and 240` | `collate "C" ~ '^[A-Za-z0-9:_+.-]{1,240}$'` |

The charset deliberately includes `.` and `+` so ISO-8601 `receivedAt` mints
(`toISOString()` / offset forms) remain valid. The plain ASCII class used by
MISE-005AW would reject those primary writer mints.

## Writer audit

| Path | Mint |
| --- | --- |
| `deliveryClientIdForOrder` | `supplier_delivery:{orderId}:{receivedAt}` |
| `receiveSupplierOrderDelivery` | defaults to domain mint; UI does not override |
| Hosted `record_supplier_delivery` | `format('supplier_delivery:%s', client_delivery_id)` |
| Demo fixtures | `demo-delivery-pantry-1`, `demo-delivery-metro-1`, … |
| pgTAP fixtures | `operational-delivery-1` |

Authenticated clients remain SELECT-only on `supplier_deliveries`.

## Out of scope

- Rewriting `record_supplier_delivery` or inventory event identity (#375)
- `activity_events.idempotency_key` (ISO / free-form memory labels)
- `restaurant_memories.dedupe_key` (supplier-name legacy keys)
- `mise_actions` / `action_outcomes` idempotency keys (#457)

## Verification

- `npm run typecheck`
- focused `supplierDeliveryIdentityLocalePin` tests
- `npm test`
