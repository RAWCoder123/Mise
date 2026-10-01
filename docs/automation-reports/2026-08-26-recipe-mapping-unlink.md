# Recipe mapping unlink (fresh on main)

Date: 2026-08-26

## Problem

Managers could add and edit POS recipe baselines, but a wrong mapping had no unlink path. Quantity cannot be set to zero, and `inventory_item_id` cannot be reassigned on update. Incorrect links therefore continued to poison future recipe depletion after POS sales.

Conflicted draft #135 targeted an older baseline. This branch reimplements the same product contract on current `origin/main` (`20b28e5`) without rewriting history.

## Change

- Migration `20260826120000_delete_recipe_mapping.sql` adds service-owned `service_delete_recipe_and_signals` (manager+).
- Edge action `delete_recipe` regenerates planning signals after filtering the mapping out; historical POS sales and inventory items are not rewritten.
- Demo and hosted repositories expose `deleteRecipeMappingAndSignals`.
- Application `deleteRecipeBaselineIngredient` rebuilds recommendations/insights without the mapping (anchored count evidence + provider mappings).
- Settings Recipes UI adds a confirm + Unlink control for managers, fail-closed when hub load is not ready.
- EN/ES/zh-Hans copy explains that past usage remains in the ledger.
- pgTAP plan bumped `362 → 368` for the six new unlink assertions.

## Verification

- Static security contract for delete path, manager-only Edge allowlist, grant/revoke, and UI wiring.
- pgTAP source assertions: manager unlink succeeds, mapping removed, historical sales/item retained, authenticated/staff denied.
- Staging service-RPC forged-tenant deny list includes the new RPC.
- Unit/typecheck gates in the automation cycle.

## Classification

Controlled pilot improvement: closes a data-integrity gap for recipe baselines. Does not claim App Store readiness or live provider proof.
