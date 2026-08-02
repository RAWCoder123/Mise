import assert from "node:assert/strict";
import test from "node:test";

import { buildRecommendationDecisionTelemetry } from "../services/domain/recommendationFeedback";

test("recommendation decision telemetry reports scrubbed quantity edit buckets", () => {
  assert.deepEqual(
    buildRecommendationDecisionTelemetry({
      originalQuantity: 10,
      acceptedQuantity: 10
    }),
    { quantity_edited: false, quantity_delta_bucket: "unchanged" }
  );
  assert.deepEqual(
    buildRecommendationDecisionTelemetry({
      originalQuantity: 10,
      acceptedQuantity: 7
    }),
    { quantity_edited: true, quantity_delta_bucket: "decreased" }
  );
  assert.deepEqual(
    buildRecommendationDecisionTelemetry({
      originalQuantity: 10,
      acceptedQuantity: 15
    }),
    { quantity_edited: true, quantity_delta_bucket: "increased" }
  );
});

test("recommendation decision telemetry never requires raw quantities for dismiss signals", () => {
  assert.deepEqual(
    buildRecommendationDecisionTelemetry({ dismissReasonPresent: true }),
    {
      quantity_edited: false,
      quantity_delta_bucket: "unchanged",
      dismiss_reason_present: true
    }
  );
  assert.deepEqual(
    buildRecommendationDecisionTelemetry({
      originalQuantity: Number.NaN,
      acceptedQuantity: 4,
      dismissReasonPresent: false
    }),
    {
      quantity_edited: false,
      quantity_delta_bucket: "unchanged",
      dismiss_reason_present: false
    }
  );
});
