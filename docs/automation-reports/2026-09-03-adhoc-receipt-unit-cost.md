# Ad-hoc receipt unit cost (2026-09-03)

Tip: `cursor/mise-adhoc-receipt-unit-cost`
Base: `origin/main` @ `20b28e5`

## Closed
- Optional display/purchase-unit cost on Log Delivery and inventory-detail Receive.
- Receipt metadata stores `unitCost` when provided; history surfaces it.
- Manager-only `apply_adhoc_receipt_unit_cost` RPC + demo parity updates
  `estimated_unit_cost`, activity, and audit evidence; regenerates operational signals.
- Distinct from order-receive invoice capture (#295) and invoice-line apply (#353),
  and from settings policy cost edit (#231).

## Paths
- `services/domain/adhocReceiptUnitCost.ts`
- `supabase/migrations/20260903071000_apply_adhoc_receipt_unit_cost.sql`
- `services/miseValidation.ts`, `services/application/inventory.ts`,
  `services/application/deliveryHistoryMerge.ts`
- `services/repositories/{repositoryContracts,demoRepository,supabaseRepository}.ts`
- `app/more/log-delivery.tsx`, `app/inventory/[id].tsx`, `i18n/catalog.ts`
- Tests: `tests/adhocReceiptUnitCost*.ts`, validation + delivery history updates

## Verification
- `npm run typecheck`
- Focused + full `npm test`
- `npm run security:static`
- `npm run design:static`

## Deploy note
Additive migration must be deployed before hosted use.
