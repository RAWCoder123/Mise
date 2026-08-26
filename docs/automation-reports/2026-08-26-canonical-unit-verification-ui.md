# Canonical unit verification UI (2026-08-26)

## Verdict

Managers can verify an inventory item’s canonical conversion from item detail.
Receive, count, waste, and stockout no longer dead-end on a warning with no recovery action.

## Why

Hosted RPC `verify_inventory_item_canonical_unit` and repository methods already existed, but
`miseService` / inventory detail only showed “Unit not verified”. Open receive fail-closed work
(#184) correctly blocks unverified lines; Greptile noted recovery navigated to Inventory without
a verification workflow. This closes that operator gap on main without duplicating #184.

## Changes

- Domain helper `suggestCanonicalUnitVerification` locks standard units and requires manual pack/case entry
- Application `verifyInventoryItemCanonicalUnit` validates input and calls the guarded repository RPC
- Inventory detail shows a manager verification form when the item is not canonical-ready
- EN / ES / zh-Hans copy for the workflow

## Paths

- `services/domain/inventoryCanonicalUnit.ts`
- `services/application/inventory.ts`
- `services/miseValidation.ts`
- `app/inventory/[id].tsx`
- `i18n/catalog.ts`
- `tests/inventoryCanonicalUnitVerification.test.ts`
- `tests/inventoryCanonicalUnitUi.test.ts`

## Verification

- `npm run typecheck`
- focused unit/UI pins for suggestion, validation, and wiring
- `npm test` (full suite)

## Do not redo

- Inventing receive discrepancy checklist (#182) or unverified receive fail-closed (#184)
- Soft-refresh draft preserve on inventory detail (#156)
- Client-side role escalation; verification remains owner/admin/manager via RPC
