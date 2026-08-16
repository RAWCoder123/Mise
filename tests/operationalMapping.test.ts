import assert from "node:assert/strict";
import test from "node:test";

import {
  assessOperationalMappingChain,
  calculateMappingCoverage,
  convertCanonicalDimension,
  findOverlappingRecipeWindows,
  normalizeOperationalQuantity,
  type OperationalMappingChain
} from "../services/domain/operationalMapping";

const at = new Date("2026-07-26T12:00:00.000Z");

function chain(menuItemId: string, verified = true): OperationalMappingChain {
  const status = verified ? "verified" : "draft";
  return {
    menuItemId,
    posMapping: {
      verificationStatus: status,
      confidence: verified ? 0.99 : 0.5,
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      effectiveTo: null
    },
    recipe: {
      verificationStatus: status,
      prepYield: 0.95,
      cookingYield: 0.9,
      servingQuantity: 1,
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      effectiveTo: null
    },
    ingredients: [
      {
        inventoryItemId: `${menuItemId}-chicken`,
        quantity: 0.45,
        unit: "lb",
        verificationStatus: status
      }
    ],
    supplierMappings: [
      {
        inventoryItemId: `${menuItemId}-chicken`,
        verificationStatus: status,
        packQuantity: 18_143.6948,
        canonicalUnit: "g"
      }
    ]
  };
}

test("normalizes mass, volume, count, and verified pack quantities", () => {
  assert.deepEqual(normalizeOperationalQuantity({ quantity: 1, unit: "kg" }), {
    ok: true,
    quantity: 1000,
    unit: "g",
    blockers: []
  });
  assert.equal(normalizeOperationalQuantity({ quantity: 2, unit: "tbsp" }).unit, "ml");
  assert.equal(normalizeOperationalQuantity({ quantity: 3, unit: "each" }).quantity, 3);
  for (const unit of ["units", "head", "heads", "piece", "pieces"]) {
    assert.deepEqual(normalizeOperationalQuantity({ quantity: 3, unit }), {
      ok: true,
      quantity: 3,
      unit: "each",
      blockers: []
    });
  }
  assert.deepEqual(
    normalizeOperationalQuantity({
      quantity: 2,
      unit: "case",
      packConversion: {
        fromUnit: "case",
        canonicalQuantity: 40 * 453.59237,
        canonicalUnit: "g",
        verified: true
      }
    }),
    {
      ok: true,
      quantity: 36_287.3896,
      unit: "g",
      blockers: []
    }
  );
});

test("fails closed for unverified packs and mass-volume conversions without density", () => {
  assert.deepEqual(
    normalizeOperationalQuantity({ quantity: 1, unit: "case" }).blockers,
    ["pack_conversion_required"]
  );
  assert.deepEqual(
    convertCanonicalDimension({ quantity: 100, fromUnit: "g", toUnit: "ml" }).blockers,
    ["density_conversion_required"]
  );
  assert.deepEqual(
    convertCanonicalDimension({
      quantity: 100,
      fromUnit: "g",
      toUnit: "ml",
      density: { gramsPerMilliliter: 2, verified: true }
    }),
    { ok: true, quantity: 50, unit: "ml", blockers: [] }
  );
});

test("requires the full verified chain for draft readiness", () => {
  const ready = assessOperationalMappingChain(chain("general-tso"), at);
  assert.equal(ready.forecastReady, true);
  assert.equal(ready.draftReady, true);

  const missingSupplier = chain("fried-rice");
  missingSupplier.supplierMappings = [];
  const blocked = assessOperationalMappingChain(missingSupplier, at);
  assert.equal(blocked.forecastReady, true);
  assert.equal(blocked.draftReady, false);
  assert.ok(blocked.blockers.includes("supplier_mapping_missing"));
});

test("uses sales volume for 90 and 95 percent enablement thresholds", () => {
  const ninetyPercent = calculateMappingCoverage({
    at,
    sales: [
      { menuItemId: "mapped", quantitySold: 90 },
      { menuItemId: "unmapped", quantitySold: 10 }
    ],
    chains: [chain("mapped")]
  });
  assert.equal(ninetyPercent.forecastCoveragePercent, 90);
  assert.equal(ninetyPercent.shadowEnabled, true);
  assert.equal(ninetyPercent.draftingEnabled, false);

  const ninetyFivePercent = calculateMappingCoverage({
    at,
    sales: [
      { menuItemId: "mapped", quantitySold: 95 },
      { menuItemId: "unmapped", quantitySold: 5 }
    ],
    chains: [chain("mapped")]
  });
  assert.equal(ninetyFivePercent.draftingEnabled, true);
});

test("detects overlapping effective-dated recipe versions at the same location", () => {
  assert.deepEqual(
    findOverlappingRecipeWindows([
      {
        id: "v1",
        menuItemId: "general-tso",
        locationId: "kitchen-1",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
        effectiveTo: "2026-08-01T00:00:00.000Z"
      },
      {
        id: "v2",
        menuItemId: "general-tso",
        locationId: "kitchen-1",
        effectiveFrom: "2026-07-01T00:00:00.000Z",
        effectiveTo: null
      }
    ]),
    [["v1", "v2"]]
  );
});
