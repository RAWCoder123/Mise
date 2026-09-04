# Inventory operator mutation failure localization

Date: 2026-09-04  
Branch: `cursor/mise-inventory-ops-mutation-i18n`  
Base: `origin/main` @ `20b28e5`

## Problem

Inventory detail and Log Delivery mutation catch paths surfaced raw `Error.message.slice(0, 220)`. Operators on Spanish or Chinese locales saw English validation / transport copy, and inventory detail did not capture mutation telemetry.

## Change

- Domain mapper `inventoryOperatorMutationFailureReasonFrom` / `inventoryOperatorMutationFailureMessageKey` converts known validation, permission, and network failures into stable catalog keys.
- Inventory detail and Log Delivery use the mapper for queue/flush catch paths and never assign raw exception text.
- `captureMiseError` covers inventory-detail submit, settings save, and add-to-order paths (Log Delivery already captured).
- EN / ES / zh-Hans failure keys for permission, network, quantity, stockout, unit, timestamp, identifier, and note limits.

## Out of scope

- Inventory ledger transport reason mapping for flush outcomes (open #385).
- Count-session mutation i18n (open #386).
- Waste / usage / adjustment on-hand preflight (open #383 / #365 / #348).
- Stockout confirm dialog (open #389).

## Verification

- `npm run typecheck`
- focused `inventoryOperatorMutationFailure` tests
- `npm test`
- `npm run security:static` / `npm run security:backend` / `npm run design:static` as available
