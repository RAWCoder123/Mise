# Automation report — post-setup inventory item create

Date: 2026-08-28  
Branch: `cursor/mise-inventory-item-create`  
Base: `origin/main` @ `20b28e5`

## Completed

- Rebuilt the closed #15 day-2 inventory create slice on current main.
- Durable `supplier_id` authority (MISE-003C): no post-setup supplier name discovery.
- Service-owned path: domain planner → Edge `create_inventory_item` →
  `service_create_inventory_item_and_signals`.
- Opening quantity writes an `inventory_events` count when the unit auto-verifies;
  custom units seed quantity until the first verified count.
- Inventory hub CTA + `/inventory/new` (EN / ES / zh-Hans) with supplier picker
  and inline `create_supplier`.
- Demo repository parity.

## Workflows now functioning (code-verified)

- Managers can add inventory SKUs after setup without reopening owner-only setup.
- Duplicate names and the 250-item restaurant ceiling are rejected.
- Cross-tenant forge probes include the new service RPC in staging checks.

## Still open

- Hosted/Docker pgTAP proof for the new migration
- Landing open stacks #130–#225
- Founder legal URLs / Apple / EAS / live POS credentials

## Classification

Controlled pilot-ready for demo + service-owned inventory create; not App Store
submission-ready.
