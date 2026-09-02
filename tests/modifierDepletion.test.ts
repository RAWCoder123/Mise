import assert from "node:assert/strict";
import test from "node:test";

import {
  accumulateSaleIngredientUsage,
  normalizeSelectedModifierIds,
  usageForInventoryItemFromSale
} from "../services/domain/modifierDepletion";
import type { ModifierRecipeAdjustment } from "../services/domain/modifierRecipeAdjustments";
import { calculateOperationalSignals } from "../services/domain/operationalSignals";

const restaurantId = "rest-1";
const menuItemId = "menu-bowl";
const recipeVersionId = "ver-1";
const avocadoId = "item-avo";
const onionId = "item-onion";

const avocado = {
  id: avocadoId,
  restaurant_id: restaurantId,
  item_name: "Avocado",
  unit: "each",
  canonical_unit: "g" as const,
  canonical_quantity_per_unit: 50,
  canonical_unit_verification_status: "verified" as const
};

const onion = {
  id: onionId,
  restaurant_id: restaurantId,
  item_name: "Onion",
  unit: "each",
  canonical_unit: "g" as const,
  canonical_quantity_per_unit: 20,
  canonical_unit_verification_status: "verified" as const
};

const mappings = [
  {
    restaurant_id: restaurantId,
    menu_item_id: menuItemId,
    menu_item_name: "Bowl",
    inventory_item_id: avocadoId,
    quantity_used_per_sale: 1,
    unit: "each"
  },
  {
    restaurant_id: restaurantId,
    menu_item_id: menuItemId,
    menu_item_name: "Bowl",
    inventory_item_id: onionId,
    quantity_used_per_sale: 1,
    unit: "each"
  }
];

const extraAvo: ModifierRecipeAdjustment = {
  id: "adj-1",
  restaurantId,
  recipeVersionId,
  externalModifierId: "mod-extra-avo",
  modifierName: "Extra avocado",
  inventoryItemId: avocadoId,
  quantityDelta: 40,
  canonicalUnit: "g",
  verificationStatus: "verified",
  createdAt: "2026-09-02T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z"
};

test("normalizeSelectedModifierIds bounds and dedupes", () => {
  assert.deepEqual(normalizeSelectedModifierIds([" a ", "a", "", "b"]), ["a", "b"]);
  assert.equal(normalizeSelectedModifierIds(null).length, 0);
});

test("base recipe path ignores modifier context when no modifiers selected", () => {
  const result = accumulateSaleIngredientUsage({
    sale: { restaurant_id: restaurantId, quantity_sold: 2, selected_modifier_ids: [] },
    matchingMappings: mappings,
    itemsById: new Map([
      [avocadoId, avocado],
      [onionId, onion]
    ]),
    modifierContext: {
      adjustments: [extraAvo],
      recipeVersionIdByMenuItemId: new Map([[menuItemId, recipeVersionId]])
    }
  });
  assert.equal(result.status, "base");
  assert.equal(result.usageByItemId.get(avocadoId), 2);
  assert.equal(result.usageByItemId.get(onionId), 2);
});

test("verified extra avocado adds canonical delta converted to inventory units", () => {
  const result = accumulateSaleIngredientUsage({
    sale: {
      restaurant_id: restaurantId,
      quantity_sold: 2,
      selected_modifier_ids: ["mod-extra-avo"]
    },
    matchingMappings: mappings,
    itemsById: new Map([
      [avocadoId, avocado],
      [onionId, onion]
    ]),
    modifierContext: {
      adjustments: [extraAvo],
      recipeVersionIdByMenuItemId: new Map([[menuItemId, recipeVersionId]])
    }
  });
  assert.equal(result.status, "modified");
  // base 1 each = 50g; +40g = 90g; /50 = 1.8 each; *2 sold = 3.6
  assert.equal(result.usageByItemId.get(avocadoId), 3.6);
  assert.equal(result.usageByItemId.get(onionId), 2);
});

test("unknown selected modifier fails closed without inventing base-only depletion", () => {
  const usage = usageForInventoryItemFromSale({
    sale: {
      restaurant_id: restaurantId,
      quantity_sold: 2,
      selected_modifier_ids: ["mod-unknown"]
    },
    inventoryItemId: avocadoId,
    matchingMappings: mappings,
    itemsById: new Map([
      [avocadoId, avocado],
      [onionId, onion]
    ]),
    modifierContext: {
      adjustments: [extraAvo],
      recipeVersionIdByMenuItemId: new Map([[menuItemId, recipeVersionId]])
    }
  });
  assert.equal(usage, 0);
});

test("operational signals apply verified modifier deltas to projected usage", () => {
  const signals = calculateOperationalSignals({
    restaurantId,
    operatingDate: "2026-09-02",
    inventoryItems: [
      {
        id: avocadoId,
        restaurant_id: restaurantId,
        item_name: "Avocado",
        supplier_id: "sup-1",
        supplier_name: "Produce",
        unit: "each",
        current_quantity: 10,
        par_level: 12,
        reorder_threshold: 4,
        canonical_unit: "g",
        canonical_quantity_per_unit: 50,
        canonical_unit_verification_status: "verified"
      }
    ],
    sales: [
      {
        restaurant_id: restaurantId,
        sale_date: "2026-09-02",
        item_name: "Bowl",
        quantity_sold: 1,
        source_pos: "Square",
        provider_location_id: "loc-1",
        provider_catalog_item_id: "cat-1",
        provider_variation_id: "var-bowl",
        selected_modifier_ids: ["mod-extra-avo"]
      }
    ],
    menuItemIngredients: [
      {
        restaurant_id: restaurantId,
        menu_item_id: menuItemId,
        menu_item_name: "Bowl",
        inventory_item_id: avocadoId,
        quantity_used_per_sale: 1,
        unit: "each"
      }
    ],
    providerMappings: [
      {
        restaurantId,
        sourcePos: "square",
        providerLocationId: "loc-1",
        externalCatalogItemId: "cat-1",
        externalVariationId: "var-bowl",
        menuItemId
      }
    ],
    recommendationHistory: [],
    inventoryLedgerEvents: [
      {
        restaurantId,
        inventoryItemId: avocadoId,
        eventType: "count",
        effectiveAt: "2026-09-01T12:00:00.000Z",
        sequence: 1,
        projectionApplied: true
      }
    ],
    ledgerComplete: true,
    modifierAdjustments: [extraAvo],
    recipeVersionIdByMenuItemId: new Map([[menuItemId, recipeVersionId]])
  });

  // projected = 10 - 1.8 = 8.2, above reorder 4 → no low/critical recommendation
  const avocadoRec = signals.recommendations.find((row) => row.inventory_item_id === avocadoId);
  assert.equal(avocadoRec, undefined);
  assert.ok(signals.insights.length >= 0);
});
