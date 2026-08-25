import assert from "node:assert/strict";
import test from "node:test";

import type { PilotReadiness, PilotReadinessArea } from "../services/domain/pilotReadiness";
import {
  todayPilotReadinessAreaLabelKey,
  todayPilotReadinessGate
} from "../services/presentation/todayPilotReadiness";

function area(
  id: PilotReadinessArea["id"],
  status: PilotReadinessArea["status"]
): PilotReadinessArea {
  return {
    id,
    status,
    summary: status,
    blockers: status === "ready" ? [] : [`${id} needs work`],
    metrics: {}
  };
}

function readiness(overrides: Partial<PilotReadiness> = {}): PilotReadiness {
  return {
    restaurantId: "rest-1",
    generatedAt: "2026-08-25T01:00:00.000Z",
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

test("todayPilotReadinessGate fails closed when readiness is missing or failed", () => {
  for (const gate of [
    todayPilotReadinessGate(null, false),
    todayPilotReadinessGate(null, true),
    todayPilotReadinessGate(readiness(), true)
  ]) {
    assert.equal(gate.operatingLoopReady, false);
    assert.equal(gate.showBanner, true);
    assert.equal(gate.bannerKind, "unavailable");
    assert.deepEqual(gate.attentionAreaIds, []);
    assert.deepEqual(gate.actions, []);
    assert.equal(gate.primaryRoute, "/settings/pos");
  }
});

test("todayPilotReadinessGate hides the banner when the operating loop is ready", () => {
  const gate = todayPilotReadinessGate(readiness(), false);
  assert.equal(gate.operatingLoopReady, true);
  assert.equal(gate.showBanner, false);
  assert.equal(gate.bannerKind, "ready");
  assert.deepEqual(gate.attentionAreaIds, []);
  assert.deepEqual(gate.actions, []);
  assert.equal(gate.primaryRoute, null);
});

test("todayPilotReadinessGate surfaces reconnect, mapping, and recipient repair work", () => {
  const gate = todayPilotReadinessGate(
    readiness({
      status: "blocked",
      canRecommend: false,
      canDraft: false,
      canSend: false,
      areas: [
        area("pos_sales", "attention"),
        area("inventory_counts", "ready"),
        area("recipe_coverage", "blocked"),
        area("supplier_routing", "ready"),
        area("email_delivery", "external")
      ]
    }),
    false
  );

  assert.equal(gate.operatingLoopReady, false);
  assert.equal(gate.showBanner, true);
  assert.equal(gate.bannerKind, "blocked");
  assert.deepEqual(gate.attentionAreaIds, [
    "pos_sales",
    "recipe_coverage",
    "email_delivery"
  ]);
  assert.deepEqual(
    gate.actions.map((action) => [action.areaId, action.route, action.labelKey]),
    [
      ["pos_sales", "/settings/pos", "today.readiness.action.pos"],
      ["recipe_coverage", "/settings/recipes", "today.readiness.action.recipes"],
      ["email_delivery", "/settings/gmail", "today.readiness.action.gmail"]
    ]
  );
  assert.equal(gate.primaryRoute, "/settings/pos");
});

test("todayPilotReadinessGate uses attention when no area is blocked or external", () => {
  const gate = todayPilotReadinessGate(
    readiness({
      status: "attention",
      canRecommend: false,
      canDraft: false,
      canSend: false,
      areas: [
        area("pos_sales", "attention"),
        area("inventory_counts", "ready"),
        area("recipe_coverage", "ready"),
        area("supplier_routing", "ready"),
        area("email_delivery", "ready")
      ]
    }),
    false
  );

  assert.equal(gate.bannerKind, "attention");
  assert.deepEqual(gate.attentionAreaIds, ["pos_sales"]);
  assert.equal(gate.primaryRoute, "/settings/pos");
});

test("todayPilotReadinessAreaLabelKey maps each readiness area", () => {
  assert.equal(todayPilotReadinessAreaLabelKey("pos_sales"), "pos.readiness.area.posSales");
  assert.equal(
    todayPilotReadinessAreaLabelKey("inventory_counts"),
    "pos.readiness.area.inventoryCounts"
  );
  assert.equal(
    todayPilotReadinessAreaLabelKey("recipe_coverage"),
    "pos.readiness.area.recipeCoverage"
  );
  assert.equal(
    todayPilotReadinessAreaLabelKey("supplier_routing"),
    "pos.readiness.area.supplierRouting"
  );
  assert.equal(
    todayPilotReadinessAreaLabelKey("email_delivery"),
    "pos.readiness.area.emailDelivery"
  );
});
