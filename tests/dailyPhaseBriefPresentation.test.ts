import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../i18n/catalog";
import { formatLocalizedDate } from "../i18n/formatters";
import type { DailyPhaseFinding } from "../services/domain/dailyPhaseBrief";
import type { OperationalTodayTask } from "../services/domain/todayTasks";
import {
  presentDailyPhaseFinding,
  presentUnavailableSignal,
  presentUnavailableSignals
} from "../services/presentation/dailyPhaseBriefPresentation";
import { englishDeliveryScheduledWhy } from "../services/presentation/operatingPlanWhyCopy";

type Translate = typeof translate extends (locale: infer _L, key: infer K, values?: infer V) => string
  ? (key: K, values?: V) => string
  : never;

function tFor(locale: "en" | "es" | "zh-Hans"): Translate {
  return (key, values) => translate(locale, key, values);
}

function countTask(overrides: Partial<OperationalTodayTask> = {}): OperationalTodayTask {
  return {
    id: "task_count_1",
    restaurantId: "rest_1",
    source: {
      kind: "inventory_count_session",
      id: "session_1",
      status: "in_progress"
    },
    title: "Verify produce count",
    detail: "Finish counting produce before service.",
    priority: "high",
    dueAt: null,
    dueDate: null,
    action: {
      intent: "continue_inventory_count_session",
      label: "Continue count",
      route: "/inventory/count",
      entityId: "session_1"
    },
    requiredRole: "manager",
    status: "open",
    completion: {
      derivedFromSource: true,
      canToggleDirectly: false,
      reason: "Count session remains open."
    },
    presentation: {
      code: "today.inventory_count_session.continue",
      values: { status: "in_progress" }
    },
    ...overrides
  };
}

test("unavailable signals localize for known labels and pass through unknowns", () => {
  const tEs = tFor("es");
  assert.equal(presentUnavailableSignal("staffing schedule", tEs), "horario de personal");
  assert.equal(presentUnavailableSignal("reservation load", tEs), "carga de reservas");
  assert.equal(presentUnavailableSignal("forecast accuracy", tEs), "precisión del pronóstico");
  assert.equal(presentUnavailableSignal("custom sensor feed", tEs), "custom sensor feed");
  assert.match(
    presentUnavailableSignals(["staffing schedule", "reservation load"], tEs),
    /horario de personal, carga de reservas/
  );
});

test("structured phase findings present localized templates without inventing facts", () => {
  const tZh = tFor("zh-Hans");
  const sourceTask = countTask();
  const englishEffect =
    "Confirms on-hand stock before service depletes coverage further.";
  const finding: DailyPhaseFinding = {
    id: "pre-service-priority:plan-count-peppers",
    tone: "attention",
    title: "Verify produce count is the next readiness move",
    interpretation: `${englishEffect} Verification: count.`,
    presentation: {
      kind: "next_readiness_move",
      taskTitle: "Verify produce count",
      effect: englishEffect,
      verificationMethod: "count",
      planEffect: {
        effect: englishEffect,
        sourceTask,
        sourceRestaurantTask: null
      }
    },
    route: "/inventory",
    evidenceReferences: ["inventory_item:peppers"]
  };
  const presented = presentDailyPhaseFinding(finding, tZh, "zh-Hans");
  assert.match(presented.title, /下一步准备动作/);
  assert.match(presented.interpretation, /验证方式：盘点/);
  assert.match(presented.interpretation, /在营业进一步消耗库存前确认现有库存/);
  assert.doesNotMatch(presented.interpretation, /Confirms on-hand stock/);

  const approvals: DailyPhaseFinding = {
    id: "morning-approvals",
    tone: "attention",
    title: "1 decision needs approval",
    interpretation: "Mise has prepared the work, but an authorized operator still owns the external decision.",
    presentation: { kind: "approvals", count: 1 },
    route: "/orders",
    evidenceReferences: ["operating-brief:approvals:1"]
  };
  const presentedApprovals = presentDailyPhaseFinding(approvals, tZh, "zh-Hans");
  assert.match(presentedApprovals.title, /待审批/);
  assert.match(presentedApprovals.interpretation, /授权操作员/);
});

test("start_with_task interpolates localized delivery why instead of durable English", () => {
  const deliveryDate = "2026-08-05";
  const englishWhy = englishDeliveryScheduledWhy(deliveryDate);
  const sourceTask = countTask({
    id: "task_send_1",
    source: { kind: "order", id: "order_1", status: "draft" },
    title: "Send Sysco order",
    detail: englishWhy,
    action: {
      intent: "send_supplier_order",
      label: "Review and send",
      route: "/orders/order_1",
      entityId: "order_1"
    },
    presentation: {
      code: "today.order.send",
      values: { supplierName: "Sysco", deliveryDate }
    }
  });
  const finding: DailyPhaseFinding = {
    id: "morning-priority:plan-send",
    tone: "attention",
    title: `Start with ${sourceTask.title}`,
    interpretation: `${englishWhy} Completing it first protects the next service window.`,
    presentation: {
      kind: "start_with_task",
      taskTitle: sourceTask.title,
      why: englishWhy,
      planWhy: {
        why: englishWhy,
        sourceTask
      }
    },
    route: "/orders",
    evidenceReferences: ["supplier_order:order_1"]
  };

  const presentedEs = presentDailyPhaseFinding(finding, tFor("es"), "es");
  const localizedDate = formatLocalizedDate("es", `${deliveryDate}T12:00:00.000Z`, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
  assert.match(presentedEs.title, /Empieza con/);
  assert.match(presentedEs.interpretation, new RegExp(localizedDate.replace(".", "\\.")));
  assert.match(presentedEs.interpretation, /entrega del proveedor/i);
  assert.doesNotMatch(presentedEs.interpretation, /Supplier delivery is scheduled/);

  const presentedZh = presentDailyPhaseFinding(finding, tFor("zh-Hans"), "zh-Hans");
  assert.match(presentedZh.interpretation, /供应商交货计划于/);
  assert.doesNotMatch(presentedZh.interpretation, /Supplier delivery is scheduled/);
});

test("closing waste attention interpolates item name without rewriting evidence", () => {
  const tEs = tFor("es");
  const waste: DailyPhaseFinding = {
    id: "closing-waste",
    tone: "attention",
    title: "2 waste entries were analyzed",
    interpretation:
      "Bell peppers repeated across 2 operating days and should shape the next prep or order decision.",
    presentation: {
      kind: "waste_analyzed",
      eventCount: 2,
      attentionItem: { itemName: "Bell peppers", dayCount: 2 }
    },
    route: "/more/waste",
    evidenceReferences: ["inventory-event:waste-1"]
  };
  const presented = presentDailyPhaseFinding(waste, tEs, "es");
  assert.match(presented.title, /entradas de merma/);
  assert.match(presented.interpretation, /Bell peppers/);
  assert.match(presented.interpretation, /2 días operativos/);
});

test("missing presentation falls back to stored English copy", () => {
  const t = tFor("es");
  const finding: DailyPhaseFinding = {
    id: "legacy",
    tone: "neutral",
    title: "Legacy English title",
    interpretation: "Legacy English body.",
    presentation: null,
    route: null,
    evidenceReferences: []
  };
  assert.deepEqual(presentDailyPhaseFinding(finding, t, "es"), {
    title: "Legacy English title",
    interpretation: "Legacy English body."
  });
});

test("English presentation matches domain fallback copy for approvals", () => {
  const tEn = tFor("en");
  const finding: DailyPhaseFinding = {
    id: "morning-approvals",
    tone: "attention",
    title: "2 decisions need approval",
    interpretation: "Mise has prepared the work, but an authorized operator still owns the external decision.",
    presentation: { kind: "approvals", count: 2 },
    route: "/orders",
    evidenceReferences: []
  };
  assert.deepEqual(presentDailyPhaseFinding(finding, tEn, "en"), {
    title: finding.title,
    interpretation: finding.interpretation
  });
});
