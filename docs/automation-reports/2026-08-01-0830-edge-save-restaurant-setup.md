# Edge-routed restaurant setup persistence

## Problem
Hosted setup already invoked `operational-workflows` `save_setup`, but `public.save_restaurant_setup` and `public.record_setup_completion_audit` remained executable by `authenticated` clients. A manager could bypass Edge reservation, rate limiting, and Edge audit while mutating inventory, suppliers, recipes, POS rows, attachments, and audit logs.

## Fix
- Migration `20260801083000_edge_save_restaurant_setup.sql` introduces actor-bound `private.service_save_restaurant_setup` / `public.service_save_restaurant_setup` and service-owned setup audit helpers.
- Ledger behavior is preserved: opening creates and quantity deltas append `inventory_movements` with `manual_count` / `save_restaurant_setup`.
- Legacy `public.save_restaurant_setup` and `public.record_setup_completion_audit` keep auth.uid()-bound wrappers but have authenticated execute revoked.
- Edge `save_setup` calls `service_save_restaurant_setup` through the service-role client.
- Hosted `recordAuditLog` rejects client audit writes; setup already records fingerprinted `setup_completed` rows.

## Verification
- Static unit/security gates: typecheck, `npm test`, `security:backend`, `security:static`, `design:static`, `qa:routes`.
- Docker pgTAP / hosted staging re-proof still required for the full migration chain.
