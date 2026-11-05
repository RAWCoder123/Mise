# Inventory event transport reasons (main rebase)

Tip: `cursor/mise-inventory-event-transport-reasons-main-rebase` — MERGEABLE onto `origin/main`.
Supersedes stale #385 (`cursor/mise-inventory-event-transport-reasons`), which was behind current main.

## What landed

- Domain: map hosted `22023` messages for unverified canonical conversion and future-dated evidence to `canonical_conversion_unverified`, `future_dated_count`, and `future_dated_event` before the opaque `invalid_inventory_event` fallback. Conversion must be matched before the `canonical unit` substring.
- Domain: `INVENTORY_EVENT_REASON_MESSAGE_KEYS` + `inventoryEventReasonMessageKey` for operator-facing queue copy.
- Demo: `recordInventoryEvent` returns a terminal rejection for unverified conversion instead of throwing (avoids permanent `network_retry` deferral).
- Inventory detail: localize known queue reason codes (EN / ES / zh-Hans) and surface specific flush copy for conversion and future-dated rejections.
- Tests: transport mapping + UI source-pin + catalog key coverage.

## Why this tip

Operators recording counts, waste, or receipts against unverified conversions or future-dated evidence saw opaque `invalid_inventory_event` (or infinite demo outbox deferral). Actionable reasons keep the outbox fail-closed without inventing inventory facts.

## Land notes

- No migration. Session-only tip.
- Does not overlap receive stacks #1100–#1102 / #670.
- Out of scope remains: on-hand insufficiency mapping (#383), broadening future-dated rejection beyond existing DB messages (#367).

## Verification

- `npm run typecheck`
- focused: `inventoryEventTransport`, `inventoryEventTransportReasonsUi`
- `npm run security:static` / `security:backend`
- `npm test`
