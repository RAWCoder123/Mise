import assert from "node:assert/strict";
import test from "node:test";

import type { PilotReadiness } from "../services/domain/pilotReadiness";
import {
  homePilotReadinessAreaLabelKey,
  homePilotReadinessGate,
  pilotReadinessAreaLabelKey,
  pilotRecommendUiGate
} from "../services/presentation/pilotRecommendUiGate";

function readiness(overrides: Partial<PilotReadiness> = {}): PilotReadiness {
  return {
    restaurantId: "rest-1",
    generatedAt: "2026-08-17T06:00:00.000Z",
    status: "ready",
    areas: [
      area("pos_sales", "ready"),
      area("inventory_counts", "ready"),
      area("recipe_coverage", "ready"),
      area("supplier_routing", "ready"),
      area("email_delivery", "ready")
    ],
    canRecommend: true,
    canDraft: true,
    canSend: true,
    ...overrides
  };
}

function area(
  id: PilotReadiness["areas"][number]["id"],
  status: PilotReadiness["areas"][number]["status"]
): PilotReadiness["areas"][number] {
  return {
    id,
    status,
    summary: status,
    blockers: status === "ready" ? [] : [`${id} blocked`],
    metrics: {}
  };
}

test("pilot recommend UI gate fails closed when the check is unavailable", () => {
  const gate = pilotRecommendUiGate(null, true);
  assert.equal(gate.canOneTapRecommend, false);
  assert.equal(gate.showBanner, true);
  assert.equal(gate.bannerKind, "unavailable");
});

test("pilot recommend UI gate fails closed when readiness is missing without an explicit error", () => {
  const gate = pilotRecommendUiGate(null, false);
  assert.equal(gate.canOneTapRecommend, false);
  assert.equal(gate.bannerKind, "unavailable");
});

test("pilot recommend UI gate blocks one-tap recommend when canRecommend is false", () => {
  const gate = pilotRecommendUiGate(
    readiness({
      status: "blocked",
      canRecommend: false,
      canDraft: false,
      canSend: false,
      areas: [
        area("pos_sales", "ready"),
        area("inventory_counts", "blocked"),
        area("recipe_coverage", "attention"),
        area("supplier_routing", "ready"),
        area("email_delivery", "ready")
      ]
    }),
    false
  );
  assert.equal(gate.canOneTapRecommend, false);
  assert.equal(gate.bannerKind, "blocked_recommend");
  assert.deepEqual(gate.attentionAreaIds, ["inventory_counts", "recipe_coverage"]);
});

test("pilot recommend UI gate allows recommend approve when only send areas are incomplete", () => {
  const gate = pilotRecommendUiGate(
    readiness({
      status: "blocked",
      canRecommend: true,
      canDraft: false,
      canSend: false,
      areas: [
        area("pos_sales", "ready"),
        area("inventory_counts", "ready"),
        area("recipe_coverage", "ready"),
        area("supplier_routing", "blocked"),
        area("email_delivery", "external")
      ]
    }),
    false
  );
  assert.equal(gate.canOneTapRecommend, true);
  assert.equal(gate.bannerKind, "blocked_send");
  assert.deepEqual(gate.attentionAreaIds, ["supplier_routing", "email_delivery"]);
});

test("pilot recommend UI gate hides the banner when the operating loop is fully ready", () => {
  const gate = pilotRecommendUiGate(readiness(), false);
  assert.equal(gate.canOneTapRecommend, true);
  assert.equal(gate.showBanner, false);
  assert.equal(gate.bannerKind, "ready");
});

test("Home alias mirrors the shared pilot recommend UI gate", () => {
  assert.equal(homePilotReadinessGate, pilotRecommendUiGate);
  assert.equal(homePilotReadinessAreaLabelKey, pilotReadinessAreaLabelKey);
});

test("pilot readiness area labels reuse the shared POS readiness catalog keys", () => {
  assert.equal(pilotReadinessAreaLabelKey("pos_sales"), "pos.readiness.area.posSales");
  assert.equal(
    pilotReadinessAreaLabelKey("inventory_counts"),
    "pos.readiness.area.inventoryCounts"
  );
  assert.equal(
    pilotReadinessAreaLabelKey("recipe_coverage"),
    "pos.readiness.area.recipeCoverage"
  );
  assert.equal(
    pilotReadinessAreaLabelKey("supplier_routing"),
    "pos.readiness.area.supplierRouting"
  );
  assert.equal(
    pilotReadinessAreaLabelKey("email_delivery"),
    "pos.readiness.area.emailDelivery"
  );
});
