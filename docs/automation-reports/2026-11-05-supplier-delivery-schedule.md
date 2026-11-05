# Supplier delivery days and order cutoff

Date: 2026-11-05  
Branch: `cursor/mise-supplier-delivery-schedule-main`

## Problem

Lead time and MOQ tips (#1116–#1118) improve item-level purchasing policy, but
suppliers still had no durable delivery schedule. Mise could recommend an order
that would miss the next truck, or fail to raise risk when coverage would not
last until the next configured delivery day.

## Change

- Additive migration `20261105210000_supplier_delivery_schedule.sql`
  - `suppliers.delivery_days` (`smallint[]`, 0=Sunday … 6=Saturday, default `{}`)
  - `suppliers.order_cutoff_minutes` (nullable local minutes 0–1439)
  - Manager RPC `update_supplier_delivery_schedule`
  - Planning snapshot gains `supplierSchedules`
- Domain helpers in `services/domain/supplierDeliverySchedule.ts`
  - Empty schedule disables the gate
  - Past cutoff on a delivery day skips that truck
  - Coverage at or below days-until-next-delivery raises a recommendation
- Settings → Suppliers editors for delivery days and cutoff (EN/ES/zh-Hans)
- Demo and hosted planning data carry supplier schedules into signal refresh

## Out of scope

- Inventory item lead time / MOQ / shelf life / safety stock (#1116–#1118)
- Zero-quantity ledger integrity (#1119)
- Expiration dating on receive (still waits on #1109/#1111)
- Purchase approval or supplier-send authority

## Verification

- Focused `tests/supplierDeliverySchedule.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- Docker pgTAP source at `supabase/tests/database/supplier_delivery_schedule.test.sql`
  (not executed in this environment)
