# Recipe mapping unlink (rebased onto main)

Date: 2026-10-06

## Problem

Managers could add and edit POS recipe baselines, but a wrong mapping had no unlink path. Quantity cannot be set to zero, and `inventory_item_id` cannot be reassigned on update. Incorrect links therefore continued to poison future recipe depletion after POS sales.

Open #183 / conflicted #135 targeted older baselines. This branch is a fresh cherry-pick onto current `origin/main` (`78da7376`) plus a UI race harden for confirmation vs debounced quantity save.

## Change

- Migration `20260826120000_delete_recipe_mapping.sql` adds service-owned `service_delete_recipe_and_signals` (manager+).
- Edge action `delete_recipe` regenerates planning signals after filtering the mapping out; historical POS sales and inventory items are not rewritten.
- Demo and hosted repositories expose `deleteRecipeMappingAndSignals`.
- Application `deleteRecipeBaselineIngredient` rebuilds recommendations/insights without the mapping (anchored count evidence + provider mappings).
- Settings Recipes UI adds a confirm + Unlink control for managers, fail-closed when hub load is not ready.
- Unlink confirmation cancels pending debounced saves immediately; confirm awaits any in-flight save and suppresses stale save errors via `unlinkGuardIdsRef`.
- EN/ES/zh-Hans copy explains that past usage remains in the ledger.
- pgTAP plan bumped `362 → 368` for the six new unlink assertions (count derived from the six added call sites).

## Verification

- Static security contract for delete path, manager-only Edge allowlist, grant/revoke, and UI wiring.
- Focused unlink contract tests cover service ownership and save/unlink race guards.
- Staging service-RPC forged-tenant deny list includes the new RPC.
- Unit/typecheck gates in the automation cycle.

## Classification

Controlled pilot improvement: closes a data-integrity gap for recipe baselines. Does not claim App Store readiness or live provider proof. Supersedes #183 / #135 once landed.
