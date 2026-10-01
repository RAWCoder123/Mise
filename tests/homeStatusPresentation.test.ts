import assert from "node:assert/strict";
import test from "node:test";

import { resolveRestaurantStatusCardHref } from "../services/presentation/homeStatusPresentation";

test("routes low-stock status to inventory even when an approval is also open", () => {
  assert.equal(
    resolveRestaurantStatusCardHref({
      hasPrimaryMenuRisk: true,
      hasPrimaryApproval: true
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
