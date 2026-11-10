# MISE-005ABS: localize inventory outbox resolutionReason (ASCII C)

Date: 2026-11-10  
Branch: `cursor/mise-inventory-outbox-resolution-reason-i18n`  
Baseline: `origin/main` @ `78da7376`

## Problem

Inventory detail queue evidence always interpolated raw `entry.resolutionReason` into `inventory.ops.queue.reason` (`Reason: {reason}`). Operators saw machine tokens such as `network_retry` instead of localized copy. Unicode-only-space reasons are truthy (blank-looking chrome), and Unicode `.trim()` on padded tokens invents a clean reason code.

## Fix

- `services/domain/presentationInventoryOutboxResolutionReasonIdentity.ts` — ASCII C soft-null + allowlisted snake_case vocabulary → MessageKey; unknown/unsafe → `reasonCode.unknown`
- `app/inventory/[id].tsx` — localize reason via `t(resolutionReasonKey)` before `inventory.ops.queue.reason`
- `i18n/catalog.ts` — EN / ES / zh-Hans reasonCode copy for the ledger/outbox/transport vocabulary
- Focused proofs in `tests/inventoryOutboxResolutionReasonAsciiC.test.ts` (54 assertion call sites from source)

## Distinct from

Finding-decision outbox `resolutionReason` status gating on Daily Brief; inventory outbox entry-id / keyPrefix ASCII tips (#784 / #787); inventory hub/detail item_name tips.

## Verification

- Focused tip tests: 6/6 pass
- Assertion plan: 54 call sites from source
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm test`

## Alone-OK

Ordinary conflict only on `app/inventory/[id].tsx` + catalog keys + new identity module/tests/report. No migration.
