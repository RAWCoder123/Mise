import assert from "node:assert/strict";
import test from "node:test";

import type { PilotReadiness } from "../services/domain/pilotReadiness";
import {
  homePilotReadinessAreaLabelKey,
  homePilotReadinessGate
} from "../services/presentation/homePilotReadinessPresentation";

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

test("Home readiness gate fails closed when the check is unavailable", () => {
  const gate = homePilotReadinessGate(null, true);
  assert.equal(gate.canOneTapRecommend, false);
  assert.equal(gate.showBanner, true);
  assert.equal(gate.bannerKind, "unavailable");
});

test("Home readiness gate fails closed when readiness is missing without an explicit error", () => {
  const gate = homePilotReadinessGate(null, false);
  assert.equal(gate.canOneTapRecommend, false);
  assert.equal(gate.bannerKind, "unavailable");
});

test("Home readiness gate blocks one-tap recommend when canRecommend is false", () => {
  const gate = homePilotReadinessGate(
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

test("Home readiness gate allows recommend approve when only send areas are incomplete", () => {
  const gate = homePilotReadinessGate(
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

test("Home readiness gate hides the banner when the operating loop is fully ready", () => {
  const gate = homePilotReadinessGate(readiness(), false);
  assert.equal(gate.canOneTapRecommend, true);
  assert.equal(gate.showBanner, false);
  assert.equal(gate.bannerKind, "ready");
});

test("Home readiness area labels reuse the shared POS readiness catalog keys", () => {
  assert.equal(homePilotReadinessAreaLabelKey("pos_sales"), "pos.readiness.area.posSales");
  assert.equal(
    homePilotReadinessAreaLabelKey("inventory_counts"),
    "pos.readiness.area.inventoryCounts"
  );
  assert.equal(
    homePilotReadinessAreaLabelKey("recipe_coverage"),
    "pos.readiness.area.recipeCoverage"
  );
  assert.equal(
    homePilotReadinessAreaLabelKey("supplier_routing"),
    "pos.readiness.area.supplierRouting"
  );
  assert.equal(
    homePilotReadinessAreaLabelKey("email_delivery"),
    "pos.readiness.area.emailDelivery"
  );
});
