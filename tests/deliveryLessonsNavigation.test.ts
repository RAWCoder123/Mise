import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DELIVERY_LESSONS_REVIEW_HREF,
  resolveDeliveryLessonsReviewHref,
  shouldOfferDeliveryLessonsReview
} from "../services/presentation/deliveryLessonsNavigation";

test("delivery lessons review href stays on the Delivery lessons hub", () => {
  assert.equal(DELIVERY_LESSONS_REVIEW_HREF, "/more/delivery-outcomes");
  assert.equal(resolveDeliveryLessonsReviewHref(), "/more/delivery-outcomes");
});

test("delivery lessons CTA only offers when attention outcomes were measured", () => {
  assert.equal(shouldOfferDeliveryLessonsReview(null), false);
  assert.equal(shouldOfferDeliveryLessonsReview(undefined), false);
  assert.equal(shouldOfferDeliveryLessonsReview(0), false);
  assert.equal(shouldOfferDeliveryLessonsReview(Number.NaN), false);
  assert.equal(shouldOfferDeliveryLessonsReview(1), true);
  assert.equal(shouldOfferDeliveryLessonsReview(3), true);
});

test("Insights and Daily Report deep-link into Delivery lessons when attention exists", () => {
  const insights = readFileSync("app/(tabs)/insights.tsx", "utf8");
  const dailyReport = readFileSync("app/more/daily-report.tsx", "utf8");

  assert.match(insights, /resolveDeliveryLessonsReviewHref/);
  assert.match(insights, /fetchAttentionSupplierDeliveryOutcomeCount/);
  assert.match(insights, /insights\.deliveryLessons\.reviewAction/);

  assert.match(dailyReport, /resolveDeliveryLessonsReviewHref/);
  assert.match(dailyReport, /fetchAttentionSupplierDeliveryOutcomeCount/);
  assert.match(dailyReport, /dailyReport\.supplierReliability\.reviewDeliveryLessons/);
});

test("delivery lessons review copy exists in EN, ES, and zh-Hans catalogs", () => {
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  for (const key of [
    "insights.deliveryLessons.title",
    "insights.deliveryLessons.attention.one",
    "insights.deliveryLessons.attention.other",
    "insights.deliveryLessons.reviewAction",
    "dailyReport.supplierReliability.reviewDeliveryLessons"
  ]) {
    const matches = catalog.match(new RegExp(`"${key.replace(/\./g, "\\.")}"`, "g")) ?? [];
    assert.equal(matches.length, 3, `${key} must exist once per locale`);
  }
});
