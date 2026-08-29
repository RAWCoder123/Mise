import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../i18n/catalog";
import type { DailyPhaseFinding } from "../services/domain/dailyPhaseBrief";
import {
  presentDailyPhaseFinding,
  presentUnavailableSignal,
  presentUnavailableSignals
} from "../services/presentation/dailyPhaseBriefPresentation";

type Translate = typeof translate extends (locale: infer _L, key: infer K, values?: infer V) => string
  ? (key: K, values?: V) => string
  : never;

function tFor(locale: "en" | "es" | "zh-Hans"): Translate {
  return (key, values) => translate(locale, key, values);
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
  const finding: DailyPhaseFinding = {
    id: "pre-service-priority:plan-count-peppers",
    tone: "attention",
    title: "Verify produce count is the next readiness move",
    interpretation: "A verified count keeps the order decision accurate. Verification: count.",
    presentation: {
      kind: "next_readiness_move",
      taskTitle: "Verify produce count",
      effect: "A verified count keeps the order decision accurate.",
      verificationMethod: "count"
    },
    route: "/inventory",
    evidenceReferences: ["inventory_item:peppers"]
  };
  const presented = presentDailyPhaseFinding(finding, tZh);
  assert.match(presented.title, /Verify produce count/);
  assert.match(presented.title, /下一步准备动作/);
  assert.match(presented.interpretation, /验证方式：盘点/);

  const approvals: DailyPhaseFinding = {
    id: "morning-approvals",
    tone: "attention",
    title: "1 decision needs approval",
    interpretation: "Mise has prepared the work, but an authorized operator still owns the external decision.",
    presentation: { kind: "approvals", count: 1 },
    route: "/orders",
    evidenceReferences: ["operating-brief:approvals:1"]
  };
  const presentedApprovals = presentDailyPhaseFinding(approvals, tZh);
  assert.match(presentedApprovals.title, /待审批/);
  assert.match(presentedApprovals.interpretation, /授权操作员/);
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
  const presented = presentDailyPhaseFinding(waste, tEs);
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
  assert.deepEqual(presentDailyPhaseFinding(finding, t), {
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
  assert.deepEqual(presentDailyPhaseFinding(finding, tEn), {
    title: finding.title,
    interpretation: finding.interpretation
  });
});
