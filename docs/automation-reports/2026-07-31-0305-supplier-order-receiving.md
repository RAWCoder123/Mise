# Supplier order placement confirmation and receiving

Date: 2026-07-31

## Problem

The purchase loop stopped after draft creation. Hosted Gmail send remains credential-gated, so managers could approve and copy orders but could not advance them to `sent` without fabricating a Gmail delivery. Sent orders also never increased on-hand inventory, so receiving was invisible to the ledger.

## Solution

1. **External placement confirmation** via authenticated RPC `confirm_supplier_order_placed` (distinct from Gmail-backed `mark_supplier_order_sent`). Audits `placement_channel: manual_external`.
2. **Receive workflow** via service-owned `service_receive_supplier_order_and_signals` + Edge action `receive_supplier_order`.
3. Receiving writes `inventory_movements.reason = receiving`, records ordered-versus-received discrepancies in metadata, marks the order `completed`, and refreshes planning signals.
4. Demo parity for place + receive.
5. Orders UI: Mark as placed (list + detail) and receive quantity editors on sent orders.
6. Today tasks keep sent orders open until received (`today.order.receive`).
7. Sealed leftover hosted client DML helpers (`createPosSale`, draft upsert/delete, direct recommendation patches).

## Verification

- Unit tests for receive planning/discrepancies
- Security static wiring for place/receive RPCs and sealed DML
- Orders UI / presentation / Today task coverage
- Typecheck + full unit suite + security:backend + design:static
