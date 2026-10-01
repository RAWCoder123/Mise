import assert from "node:assert/strict";
import test from "node:test";

import { resolveRestaurantStatusCardHref } from "../services/presentation/homeStatusPresentation";

test("deep-links low-stock status to the named inventory item even when an approval is also open", () => {
  assert.equal(
    resolveRestaurantStatusCardHref({
      primaryMenuRiskItemId: "inv_chicken",
      hasPrimaryMenuRisk: true,
      hasPrimaryApproval: true
    }),
    "/inventory/inv_chicken"
  );
});

test("falls back to the inventory hub when a menu risk has no safe item id", () => {
  assert.equal(
    resolveRestaurantStatusCardHref({
      primaryMenuRiskItemId: "inv/chicken",
      hasPrimaryMenuRisk: true,
      hasPrimaryApproval: false
    }),
    "/inventory"
  );
  assert.equal(
    resolveRestaurantStatusCardHref({
      primaryMenuRiskItemId: "   ",
      hasPrimaryMenuRisk: true,
      hasPrimaryApproval: false
    }),
    "/inventory"
  );
  assert.equal(
    resolveRestaurantStatusCardHref({
      hasPrimaryMenuRisk: true,
      hasPrimaryApproval: false
    }),
    "/inventory"
  );
});

test("routes approval-led status to orders when no menu risk leads", () => {
  assert.equal(
    resolveRestaurantStatusCardHref({
      hasPrimaryMenuRisk: false,
      hasPrimaryApproval: true
    }),
    "/orders"
  );
});

test("routes generic attention status to today when neither risk nor approval leads", () => {
  assert.equal(
    resolveRestaurantStatusCardHref({
      hasPrimaryMenuRisk: false,
      hasPrimaryApproval: false
    }),
    "/today"
  );
});
