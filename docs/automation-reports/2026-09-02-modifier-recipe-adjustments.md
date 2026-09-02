# Modifier recipe adjustments manager CRUD (2026-09-02)

Tip: `cursor/mise-modifier-recipe-adjustments` on `origin/main` @ `20b28e5`.

## Closed
1. Authenticated SECURITY DEFINER RPCs for draft/verify/reject/expire of
   `modifier_recipe_adjustments` (SELECT-only table DML unchanged).
2. Ensures a restaurant-wide `recipe_versions` row when mapping a menu item
   (prefer draft, else current verified, else create default-yield draft).
3. Settings → POS modifiers screen with EN/ES/zh-Hans copy; demo parity.
4. Pure `applyVerifiedModifierDeltas` helper fails closed when a selected
   modifier lacks a verified mapping (depletion wiring remains a later gate).

## Proof
- `npm run typecheck`
- `npm test` (modifierRecipeAdjustments* + demo schema 14)
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`

## Do not redo / next
- Do not invent MOQ / lead_time / expiration columns.
- Consume verified modifiers in POS depletion only after Square modifier
  extraction + this tip land; stack after #337/#338/#340 as needed.
- Land/rebase open stacks onto main without duplicating gates.
