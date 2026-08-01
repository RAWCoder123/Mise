import assert from "node:assert/strict";
import test from "node:test";

import { createInitialDemoState } from "../services/demoData";
import { buildLearningMemorySummary } from "../services/domain/miseDomain";
import { OPERATIONAL_TODAY_TASK_ACTION_INTENTS } from "../services/domain/todayTasks";
import {
  presentInsight,
  presentLearningMemory,
  presentOperationalTodayTask,
  presentOperationalTodayTaskAction
} from "../services/presentation/operationsPresentation";
import type { Insight } from "../types/mise";
import {
  INSIGHT_PRESENTATION_CODES,
  LEARNING_MEMORY_SIGNAL_PRESENTATION_CODES,
  TODAY_TASK_PRESENTATION_CODES,
  type InsightPresentationDescriptor,
  type TodayTaskPresentationDescriptor
} from "../types/presentation";

const locales = ["en", "es", "zh-Hans"] as const;
const itemName = "龙门 Tomato";
const supplierName = "Proveedor Ñ";
const providerName = "Square 企业";

test("every Today task action intent has a localized non-fallback label", () => {
  assert.equal(OPERATIONAL_TODAY_TASK_ACTION_INTENTS.length, 13);

  for (const locale of locales) {
    for (const intent of OPERATIONAL_TODAY_TASK_ACTION_INTENTS) {
      const label = presentOperationalTodayTaskAction(locale, {
        action: {
          intent,
          label: "unused-legacy-label",
          route: "/inventory",
          entityId: null
        },
        presentation: undefined
      });
      assert.ok(label.trim().length > 0, `${locale} ${intent}`);
      assert.notEqual(label, "unused-legacy-label");
    }

    const continueLabel = presentOperationalTodayTaskAction(locale, {
      action: {
        intent: "continue_inventory_count_session",
        label: "legacy",
        route: "/inventory/count",
        entityId: "session"
      },
      presentation: { code: "today.inventory_count_session.continue", values: { status: "in_progress" } }
    });
    const approveLabel = presentOperationalTodayTaskAction(locale, {
      action: {
        intent: "continue_inventory_count_session",
        label: "legacy",
        route: "/inventory/count",
        entityId: "session"
      },
      presentation: { code: "today.inventory_count_session.approve", values: { status: "submitted" } }
    });
    assert.notEqual(continueLabel, approveLabel, `${locale} count-session action labels diverge`);

    const manageLabel = presentOperationalTodayTaskAction(locale, {
      action: {
        intent: "manage_pos_connection",
        label: "legacy",
        route: "/settings/pos",
        entityId: "pos"
      },
      presentation: {
        code: "today.integration.connected",
        values: { providerName, status: "connected", lastSyncAt: null }
      }
    });
    const repairLabel = presentOperationalTodayTaskAction(locale, {
      action: {
        intent: "manage_pos_connection",
        label: "legacy",
        route: "/settings/pos",
        entityId: "pos"
      },
      presentation: {
        code: "today.integration.repair",
        values: { providerName, status: "error", lastSyncAt: null }
      }
    });
    assert.notEqual(manageLabel, repairLabel, `${locale} POS connection action labels diverge`);
  }
});

test("every allowlisted Today presentation code renders in all locales and preserves business names", () => {
  const descriptors: TodayTaskPresentationDescriptor[] = [
    { code: "today.recommendation.review", values: { itemName, rawReason: "Raw rule evidence" } },
    { code: "today.recommendation.prepare_draft", values: { itemName, supplierName } },
    { code: "today.inventory.confirm_count", values: { itemName, projectedQuantity: 12.5, unit: "lb" } },
    { code: "today.inventory.resolve_stock", values: { itemName, projectedQuantity: 2.5, unit: "kg", status: "Critical" } },
    { code: "today.inventory_count_session.begin", values: { riskItemCount: 3 } },
    { code: "today.inventory_count_session.continue", values: { status: "in_progress" } },
    { code: "today.inventory_count_session.approve", values: { status: "submitted" } },
    { code: "today.order.send", values: { supplierName, deliveryDate: null } },
    { code: "today.order.receive", values: { supplierName, deliveryDate: null } },
    { code: "today.order.review", values: { supplierName, deliveryDate: "2026-07-20" } },
    { code: "today.setup.profile.open", values: { rawEvidence: "Raw setup evidence" } },
    { code: "today.setup.profile.complete", values: { rawEvidence: "Raw setup evidence" } },
    { code: "today.setup.inventory.open", values: { rawEvidence: "Raw setup evidence" } },
    { code: "today.setup.inventory.complete", values: { rawEvidence: "Raw setup evidence" } },
    { code: "today.setup.recipes.open", values: { rawEvidence: "Raw setup evidence" } },
    { code: "today.setup.recipes.complete", values: { rawEvidence: "Raw setup evidence" } },
    { code: "today.setup.email.connect", values: { rawEvidence: "Raw setup evidence" } },
    { code: "today.setup.email.reconnect", values: { rawEvidence: "Raw setup evidence" } },
    { code: "today.setup.email.complete", values: { rawEvidence: "Raw setup evidence" } },
    { code: "today.integration.connect", values: {} },
    {
      code: "today.integration.connected",
      values: { providerName, status: "connected", lastSyncAt: "2026-07-19T12:00:00.000Z" }
    },
    {
      code: "today.integration.repair",
      values: { providerName, status: "error", lastSyncAt: null }
    },
    {
      code: "today.insight.review",
      values: {
        insightType: "sales",
        rawTitle: "Opaque source title",
        rawEvidence: "Opaque source evidence"
      }
    },
    {
      code: "today.recipe.map_unmapped",
      values: { unmappedCount: 2, sampleItemName: itemName }
    }
  ];

  assert.deepEqual(descriptors.map(({ code }) => code), [...TODAY_TASK_PRESENTATION_CODES]);
  for (const locale of locales) {
    for (const descriptor of descriptors) {
      const rawTitle = "Legacy raw title";
      const rawDetail = "Legacy raw detail";
      const presented = presentOperationalTodayTask(locale, {
        title: rawTitle,
        detail: rawDetail,
        presentation: descriptor
      });
      assert.ok(presented.title.length > 0, `${locale} ${descriptor.code} title`);
      assert.ok(presented.detail.length > 0, `${locale} ${descriptor.code} detail`);
      assert.equal(presented.evidenceOnly, false);
      const rendered = `${presented.title} ${presented.detail}`;
      const dynamicValues = Object.values(descriptor.values);
      for (const name of [itemName, supplierName, providerName]) {
        if (dynamicValues.includes(name)) assert.ok(rendered.includes(name), `${descriptor.code} preserves ${name}`);
      }
      assert.equal(rawTitle, "Legacy raw title");
      assert.equal(rawDetail, "Legacy raw detail");
    }
  }
});

test("rules-based Insight codes localize structured values while opaque copy is explicitly evidence", () => {
  const descriptors: InsightPresentationDescriptor[] = [
    {
      code: "insight.rule.inventory.stock_risk",
      values: {
        itemName,
        projectedQuantity: 1.25,
        unit: "kg",
        supplierName,
        suggestedOrderQuantity: 12,
        status: "Critical"
      }
    },
    { code: "insight.rule.sales.demand_rising", values: { itemName, liftPercent: 25 } },
    {
      code: "insight.rule.prep.low_stock",
      values: { menuItemName: itemName, inventoryItemName: "Crème fraîche", supplierName }
    },
    { code: "insight.rule.waste.overstock", values: { itemName, quantity: 44.5, unit: "lb" } },
    {
      code: "insight.evidence.opaque",
      values: {
        insightType: "cost",
        rawTitle: `Operator note for ${itemName}`,
        rawDescription: "Keep this text exactly.",
        rawWhyItMatters: "Provider-authored evidence.",
        rawRecommendedAction: `Ask ${supplierName}.`
      }
    }
  ];
  assert.deepEqual(descriptors.map(({ code }) => code), [...INSIGHT_PRESENTATION_CODES]);

  for (const locale of locales) {
    for (const presentation of descriptors) {
      const insight: Insight = {
        id: presentation.code,
        restaurant_id: "restaurant_a",
        insight_type: presentation.code === "insight.evidence.opaque"
          ? presentation.values.insightType
          : presentation.code.includes("inventory")
            ? "inventory"
            : presentation.code.includes("sales")
              ? "sales"
              : presentation.code.includes("prep")
                ? "prep"
                : "waste",
        title: "Raw title remains unchanged",
        description: "Raw description remains unchanged",
        why_it_matters: "Raw why remains unchanged",
        recommended_action: "Raw action remains unchanged",
        severity: "warning",
        created_at: "2026-07-19T12:00:00.000Z",
        presentation
      };
      const before = JSON.stringify(insight);
      const rendered = presentInsight(locale, insight);
      assert.ok(rendered.title.length > 0);
      assert.ok(rendered.description.length > 0);
      assert.ok(rendered.recommendedAction.length > 0);
      assert.equal(rendered.evidenceOnly, presentation.code === "insight.evidence.opaque");
      assert.equal(JSON.stringify(insight), before, "presentation must not mutate authoritative evidence");
      if (JSON.stringify(presentation.values).includes(itemName)) {
        assert.ok(`${rendered.title} ${rendered.description} ${rendered.recommendedAction}`.includes(itemName));
      }
      if (JSON.stringify(presentation.values).includes(supplierName)) {
        assert.ok(`${rendered.title} ${rendered.description} ${rendered.recommendedAction}`.includes(supplierName));
      }
    }
  }

  const manual: Insight = {
    id: "manual",
    restaurant_id: "restaurant_a",
    insight_type: "sales",
    title: "Operator authored title",
    description: "Operator authored detail",
    why_it_matters: null,
    recommended_action: "Operator authored action",
    severity: "info",
    created_at: "2026-07-19T12:00:00.000Z"
  };
  const fallback = presentInsight("es", manual);
  assert.equal(fallback.evidenceOnly, true);
  assert.match(fallback.description, /^Evidencia:/);
  assert.match(fallback.recommendedAction, /^Recomendación de origen:/);
  assert.ok(fallback.description.includes(manual.title));
});

test("learning memory emits complete structured signal values and localized next steps", () => {
  const state = createInitialDemoState("Toast");
  const restaurant = state.restaurants[0]!;
  const memory = buildLearningMemorySummary(
    restaurant,
    state.posSales,
    state.inventoryItems,
    state.purchaseRecommendations,
    state.insights,
    state.menuItemIngredients,
    state.supplierOrders
  );

  assert.ok(memory.presentation);
  assert.deepEqual(
    memory.signals.map((signal) => signal.presentation?.code),
    [...LEARNING_MEMORY_SIGNAL_PRESENTATION_CODES]
  );
  for (const locale of locales) {
    const rendered = presentLearningMemory(locale, memory);
    assert.equal(rendered.signals.length, LEARNING_MEMORY_SIGNAL_PRESENTATION_CODES.length);
    assert.ok(rendered.label.length > 0);
    assert.ok(rendered.operatorCopy.length > 0);
    assert.ok(rendered.nextStep.length > 0);
    assert.ok(rendered.signals.every((signal) => signal.label && signal.value && signal.detail));
  }
  assert.notEqual(presentLearningMemory("es", memory).nextStep, memory.nextStep);
  assert.notEqual(presentLearningMemory("zh-Hans", memory).signals[0]?.detail, memory.signals[0]?.detail);
});
