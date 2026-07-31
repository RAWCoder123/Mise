# Staff waste discoverability (2026-07-31)

## Problem
Staff could already record waste through Edge/SQL (`record_waste`, staff roles, Edge firewall), but the Inventory list never surfaced the workflow. On item detail, the waste card sat below read-only count settings, so staff had to know to open an item and scroll.

## Change
- Inventory list shows a waste tip card when `canRecordInventoryWaste` is true, with a secondary action that focuses search so operators can open an item quickly.
- Staff detail (`!canManage && canRecordWaste`) renders the waste card above read-only count settings via shared `WasteRecordingCard`.
- EN/ES/zh-Hans copy under `inventory.waste.*`.

## Verification
- Static contract tests in `tests/security.test.ts` and `tests/inventoryWaste.test.ts`.
- `npm run typecheck` and `npm test` on this branch tip.
