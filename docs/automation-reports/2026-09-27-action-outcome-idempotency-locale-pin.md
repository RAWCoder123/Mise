# MISE-005AW: pin mise_actions / action_outcomes idempotency_key CHECK to COLLATE C

Date: 2026-09-27  
Branch: `cursor/mise-action-outcome-idempotency-locale-pin`  
Base: `origin/main` @ `78da737`

## Change

Replace length-only `idempotency_key` CHECKs on:

- `public.mise_actions`
- `public.action_outcomes`

with ASCII shape gates under `COLLATE "C"`:

```sql
idempotency_key collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'
```

## Why

These keys are the durable per-restaurant unique identity for prepared supplier-send actions and measured delivery outcomes. Length-only bounds accept spaces, control bytes, and non-ASCII that diverge under `LC_CTYPE` drift across dump/restore. MISE-005A already proved that class of locale drift on this cluster.

## Writer audit (ASCII-only)

| Path | Mint |
| --- | --- |
| Foundation supplier_orders INSERT trigger | `format('send_supplier_order:%s', new.id)` |
| Foundation backfill | `format('send_supplier_order:%s', orders.id)` |
| `record_supplier_delivery` outcome insert | `format('supplier_delivery_outcome:%s', delivery_row.id)` |
| Demo parity helper | `{restaurantId}:{actionType}:{subjectId}` |
| pgTAP fixture | `read-only-fixture`, `send_supplier_order:<uuid>` |

Authenticated clients remain SELECT-only on both tables.

## Out of scope

- `activity_events.idempotency_key` (ISO timestamps / free-form memory labels)
- `restaurant_memories.dedupe_key` (supplier-name legacy keys)
- `inventory_events` identity (#375)
- `operational_issues.dedupe_key` (#456)
- Rewriting supplier-send / delivery RPCs

## Verification

- `npm run typecheck`
- focused `actionOutcomeIdempotencyLocalePin` tests
- `npm test`
