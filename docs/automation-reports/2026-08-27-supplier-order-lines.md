# Durable structured supplier order lines (2026-08-27)

## Completed
- Additive `public.supplier_order_lines` with tenant composite FKs, SELECT-only RLS for members, no authenticated DML.
- `private.sync_supplier_order_lines` dual-writes from linked approved/ordered recommendations.
- Approve / undo / Gmail send-completion wrappers refresh durable lines; empty-draft undo cascades lines away.
- Demo parity via `supplierOrderLines` + rebuild on approve/undo/send.
- Order detail shows structured lines; export + security allowlists updated.
- Gap audit Supplier draft moved READY → PARTIAL (lines exist; receive cutover deferred).

## Paths
- `supabase/migrations/20260827020000_supplier_order_lines.sql`
- `supabase/tests/database/supplier_order_lines.test.sql`
- `services/domain/supplierOrderLines.ts`
- `services/demo/{demoWorkflows,replaceableDemoData}.ts`
- `services/repositories/{repositoryContracts,demoRepository,supabaseRepository}.ts`
- `services/application/orders.ts`, `app/orders/[id].tsx`, `i18n/catalog.ts`
- `tests/supplierOrderLines*.test.ts`

## Intentionally deferred
- Point receive at durable lines (stack after #182/#184).
- Authoritative order totals (still blocked when costs incomplete).

## Next
1. Land/rebase open stacks (#130–#195) without duplicating gates.
2. Receive source switch to `supplier_order_lines`.
3. Optional purchase-loop → recommendation policy after authority gates.
