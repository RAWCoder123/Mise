# Count session failure localization

Date: 2026-09-04  
Branch: `cursor/mise-count-session-failure-i18n`  
Base: `origin/main` @ `20b28e5`

## Problem

Inventory count start/save/submit/approve/cancel failures on main surfaced raw Postgres or demo English messages (including the 250-item session cap). Operators got opaque, English-only errors even when the UI locale was Spanish or Chinese.

## Change

- Domain mapper `inventoryCountSessionFailureReasonFrom` / `inventoryCountSessionFailureMessageKey` converts known RPC, demo, and client validation failures into stable reason codes and catalog keys.
- Count UI uses the mapper for every mutation path and never assigns `caught.message` directly.
- Client note/incomplete validation throws `InventoryCountSessionClientError` so localized copy stays consistent.
- EN / ES / zh-Hans keys cover item cap, already-open, session missing, editability, planning conflict, permission, quantity limits, and related failures, plus a generic start fallback.

## Out of scope

- Begin-or-resume of an already-open session (open #384).
- Waste / usage / adjustment on-hand preflight (open #383 / #365 / #348).
- Inventory ledger transport reason mapping (open #385).

## Verification

- `npm run typecheck`
- focused `inventoryCountSessionFailure` tests
- `npm test`
- `npm run security:static` / `npm run security:backend` / `npm run design:static` as available
