# Receipt expiration dating (ad-hoc receive)

Date: 2026-11-10  
Branch: `cursor/mise-receipt-expiration-dating-main`  
Baseline: `origin/main` @ `78da7376`

## Summary

Operators can optionally record a lot use-by date (`YYYY-MM-DD`) when logging an
ad-hoc inventory receipt from Log Delivery or Inventory detail. The date is
stored as bounded `metadata.expires_on` on the append-only inventory ledger and
surfaced in delivery history. Invalid or out-of-range values fail closed.

## Why

Inventory accuracy / food-safety substrate. Top uncovered product gap after the
open receive stacks (#670 / #1109 / #1111) and distinct from item-level
`shelf_life_days` (#1117). Scoped to ad-hoc receipt paths so it stays Alone-OK
beside those drafts without wrapping `record_supplier_delivery`.

## Changes

- Domain: `services/domain/receiptExpiration.ts`
- Client validation: optional `expiresOn` on `requireInventoryOperation` (receipts only)
- History: `DeliveryHistoryEntry.expiresOn` via soft-null metadata read
- UI: Log Delivery + Inventory detail receive field; EN/ES/zh-Hans
- Migration: `20261110171000_receipt_expiration_dating.sql` BEFORE INSERT trigger
- Tests: `tests/receiptExpiration.test.ts`; pgTAP structural source

## Intentionally not in this tip

- Order Mark Received per-line expiration UI (waits on #670 discrepancy checklist)
- Inferring expires_on from shelf_life_days
- Waste-risk / Home surfaces driven by lot dates (later, after #1117 lands)

## Verification

See commit / PR checks.
