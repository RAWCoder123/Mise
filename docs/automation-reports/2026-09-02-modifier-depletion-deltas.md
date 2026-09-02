# POS sale selected modifier ids → verified depletion (2026-09-02)

Tip: `cursor/mise-modifier-depletion-deltas` stacked on #342
(`cursor/mise-square-line-item-modifiers-sync`).

## Closed
1. Domain `modifierRecipeAdjustments` + `modifierDepletion` — fail-closed
   verified delta application with canonical conversion.
2. `pos_sales.selected_modifier_ids` + Square `normalizeOrderSales` attach
   catalog-backed modifier ids per sale line.
3. Migration updates scoped Square sync apply + `fetch_planning_sales` so
   modifier-bearing lines stay unaggregated for planning.
4. `estimateUsage` / `buildInventoryPrediction` / `calculateOperationalSignals`
   consume selected ids when adjustment context is provided.

## Non-goals
- Manager CRUD UI (#341) — SELECT/verified rows only; no inventing deltas.
- Ingredient substitutions / recipe yield consumption.
- Inventing MOQ / lead_time / expiration.
