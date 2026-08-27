import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_DECISION_ADVISORY_RATIO_MAX,
  PURCHASE_DECISION_ADVISORY_RATIO_MIN,
  PURCHASE_DECISION_PATTERN_VERSION,
  applyEstablishedPatternAdvisoryQuantity,
  describePurchaseDecisionAdvisoryQuantity,
  selectAdvisoryPurchaseDecisionPattern,
  type PurchaseDecisionPattern
} from "../services/domain/purchaseDecisionMemory";
import { calculateOperationalSignals } from "../services/domain/operationalSignals";

function pattern(overrides: Partial<PurchaseDecisionPattern> = {}): PurchaseDecisionPattern {
  return {
    patternVersion: PURCHASE_DECISION_PATTERN_VERSION,
    inventoryItemId: "item-1",
    supplierId: "supplier-1",
    canonicalUnit: "each",
    recommendationSource: "mise_rules",
    sampleCount: 5,
    approvalCount: 5,
    exactApprovalCount: 0,
    overrideCount: 5,
    upwardOverrideCount: 0,
    downwardOverrideCount: 5,
    dismissalCount: 0,
    approvalRate: 1,
    dismissalRate: 0,
    medianQuantityRatio: 0.8,
    medianQuantityDelta: -2,
    recentSampleCount: 5,
    firstDecisionAt: "2026-08-01T00:00:00.000Z",
    lastDecisionAt: "2026-08-20T00:00:00.000Z",
    evidenceEventIds: ["e1", "e2", "e3", "e4", "e5"],
    eligible: true,
    evidenceStrength: "established",
    dominantOutcome: "downward",
    currentContext: true,
    ...overrides
  };
}

test("established downward pattern applies bounded ratio to calculated quantity", () => {
  const advisory = applyEstablishedPatternAdvisoryQuantity({
    calculatedQuantity: 10,
    parLevel: 20,
    pattern: pattern({ medianQuantityRatio: 0.8, dominantOutcome: "downward" })
  });
  assert.equal(advisory.applied, true);
  assert.equal(advisory.quantity, 8);
  assert.equal(advisory.medianQuantityRatio, 0.8);
  assert.match(
    describePurchaseDecisionAdvisoryQuantity("cs", advisory) ?? "",
    /established purchase-decision pattern/
  );
});

test("established upward pattern applies bounded ratio", () => {
  const advisory = applyEstablishedPatternAdvisoryQuantity({
    calculatedQuantity: 10,
    parLevel: 20,
    pattern: pattern({
      medianQuantityRatio: 1.2,
      dominantOutcome: "upward",
      downwardOverrideCount: 0,
      upwardOverrideCount: 5
    })
  });
  assert.equal(advisory.applied, true);
  assert.equal(advisory.quantity, 12);
});

test("emerging and dismiss-dominant patterns never change quantity", () => {
  const emerging = applyEstablishedPatternAdvisoryQuantity({
    calculatedQuantity: 10,
    parLevel: 20,
    pattern: pattern({ evidenceStrength: "emerging", eligible: true })
  });
  assert.equal(emerging.applied, false);
  assert.equal(emerging.quantity, 10);

  const dismiss = selectAdvisoryPurchaseDecisionPattern(
    [pattern({ dominantOutcome: "dismiss", dismissalCount: 5, approvalCount: 0 })],
    {
      inventoryItemId: "item-1",
      supplierId: "supplier-1",
      canonicalUnit: "each"
    }
  );
  assert.equal(dismiss, null);

  const outOfBound = applyEstablishedPatternAdvisoryQuantity({
    calculatedQuantity: 10,
    parLevel: 20,
    pattern: pattern({ medianQuantityRatio: PURCHASE_DECISION_ADVISORY_RATIO_MAX + 0.1 })
  });
  assert.equal(outOfBound.applied, false);
  assert.equal(outOfBound.quantity, 10);

  const tooLow = applyEstablishedPatternAdvisoryQuantity({
    calculatedQuantity: 10,
    parLevel: 20,
    pattern: pattern({ medianQuantityRatio: PURCHASE_DECISION_ADVISORY_RATIO_MIN - 0.1 })
  });
  assert.equal(tooLow.applied, false);
});

test("calculateOperationalSignals prefers established pattern over absolute history median", () => {
  const now = new Date().toISOString();
  const signals = calculateOperationalSignals({
    restaurantId: "rest-1",
    operatingDate: now.slice(0, 10),
    inventoryItems: [
      {
        id: "item-1",
        restaurant_id: "rest-1",
        item_name: "Roma Tomatoes",
        supplier_id: "supplier-1",
        supplier_name: "Local Produce",
        unit: "cs",
        current_quantity: 1,
        par_level: 12,
        reorder_threshold: 4,
        canonical_unit: "each",
        canonical_unit_verification_status: "verified"
      }
    ],
    sales: [],
    menuItemIngredients: [],
    recommendationHistory: [
      {
        inventory_item_id: "item-1",
        recommended_quantity: 14,
        unit: "cs",
        status: "approved",
        created_at: new Date(Date.now() - 10 * 86_400_000).toISOString()
      },
      {
        inventory_item_id: "item-1",
        recommended_quantity: 15,
        unit: "cs",
        status: "approved",
        created_at: new Date(Date.now() - 8 * 86_400_000).toISOString()
      },
      {
        inventory_item_id: "item-1",
        recommended_quantity: 16,
        unit: "cs",
        status: "approved",
        created_at: new Date(Date.now() - 6 * 86_400_000).toISOString()
      }
    ],
    purchaseDecisionPatterns: [pattern()],
    inventoryLedgerEvents: [
      {
        restaurantId: "rest-1",
        inventoryItemId: "item-1",
        eventType: "count",
        effectiveAt: now,
        sequence: 1,
        projectionApplied: true
      }
    ],
    ledgerComplete: true
  });

  assert.equal(signals.recommendations.length, 1);
  // Calculated suggestion is ceil(12 - 1) = 11; established ratio 0.8 → 9.
  // Absolute history median (~20) would otherwise win without 004B.
  assert.equal(signals.recommendations[0]!.recommended_quantity, 9);
  assert.match(signals.recommendations[0]!.reason, /established purchase-decision pattern/);
  assert.doesNotMatch(signals.recommendations[0]!.reason, /stable median from recent approved orders/);
});

test("snake_case snapshot pattern rows normalize for advisory influence", () => {
  const now = new Date().toISOString();
  const signals = calculateOperationalSignals({
    restaurantId: "rest-1",
    operatingDate: now.slice(0, 10),
    inventoryItems: [
      {
        id: "item-1",
        restaurant_id: "rest-1",
        item_name: "Roma Tomatoes",
        supplier_id: "supplier-1",
        supplier_name: "Local Produce",
        unit: "cs",
        current_quantity: 0,
        par_level: 10,
        reorder_threshold: 2,
        canonical_unit: "each",
        canonical_unit_verification_status: "verified"
      }
    ],
    sales: [],
    menuItemIngredients: [],
    recommendationHistory: [],
    purchaseDecisionPatterns: [
      {
        pattern_version: "mise.purchase_pattern.v1",
        inventory_item_id: "item-1",
        supplier_id: "supplier-1",
        canonical_unit: "each",
        recommendation_source: "mise_rules",
        sample_count: 5,
        approval_count: 5,
        exact_approval_count: 0,
        override_count: 5,
        upward_override_count: 0,
        downward_override_count: 5,
        dismissal_count: 0,
        approval_rate: 1,
        dismissal_rate: 0,
        median_quantity_ratio: 0.8,
        median_quantity_delta: -2,
        recent_sample_count: 5,
        first_decision_at: "2026-08-01T00:00:00.000Z",
        last_decision_at: "2026-08-20T00:00:00.000Z",
        evidence_event_ids: ["e1"],
        eligible: true,
        evidence_strength: "established",
        dominant_outcome: "downward",
        current_context: true
      }
    ],
    inventoryLedgerEvents: [
      {
        restaurantId: "rest-1",
        inventoryItemId: "item-1",
        eventType: "count",
        effectiveAt: now,
        sequence: 1,
        projectionApplied: true
      }
    ],
    ledgerComplete: true
  });

  assert.equal(signals.recommendations.length, 1);
  assert.equal(signals.recommendations[0]!.recommended_quantity, 8);
});
