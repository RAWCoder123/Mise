# Completed-order receive discrepancy summary (2026-08-28)

## Gap

`/orders/[id]` already showed aggregate delivery verification (status, timing,
line/issue counts) from `supplier_deliveries`, but managers could not see the
ordered-versus-received line detail after an order became `completed`. Short
ships, overages, damaged/missing quantities, and discrepancy reasons stayed
buried in delivery tables.

## Change

- Domain: `buildCompletedSupplierOrderReceiveSummary` reconstructs a bounded
  read-only summary from authoritative delivery + delivery-item evidence
  (max 100 lines), with tenant isolation and inventory name/unit enrichment.
- Application: `fetchSupplierOrderOperationalDetail` returns `receiveSummary`
  alongside existing `deliveryEvidence`.
- UI: each delivery evidence card on `/orders/[id]` lists received lines with
  matched/short/over badges, ordered vs received quantities, damage/missing,
  and optional discrepancy reason.
- Demo: Metro Produce short cabbage delivery (`…605` / `…d03`) includes an
  explicit `discrepancy_reason`; demo receive writes persist the same field.
- i18n: EN / ES / zh-Hans keys under `orders.detail.receivedSummary.*`.

## Verification

- `npm run typecheck` — passed
- `npm test` — 636 passed, 0 failed, 7 cancelled (known `withTimeout` flake)
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed

## Classification

Controlled pilot-ready for this completed-order review path in demo/local
reads. Hosted RLS proof remains environment-blocked (Docker/pgTAP). Per-line
receive editing and put-away remain owned by other open stacks.
