import assert from "node:assert/strict";
import test from "node:test";

import { buildInventoryCoverageGuidance } from "../services/domain/inventoryCoverageGuidance";
import { presentInventoryCoverageGuidance } from "../services/presentation/inventoryCoveragePresentation";
import type { MessageKey, MessageValues } from "../i18n/catalog";

const en: Record<string, string> = {
  "inventory.coverage.learning.title": "Still learning usage",
  "inventory.coverage.learning.body": "Mise needs mapped sales history before translating par into days of cover.",
  "inventory.coverage.aligned.title": "Par covers recent usage",
  "inventory.coverage.aligned.body": "Par and reorder settings line up with recent average daily usage.",
  "inventory.coverage.misconfigured.title": "Reorder is at or above par",
  "inventory.coverage.misconfigured.body": "Reorder should stay below par so Mise can signal before stock runs out.",
  "inventory.coverage.tight_reorder.title": "Reorder cover is tight",
  "inventory.coverage.tight_reorder.body": "At recent usage, reorder leaves under a day of cover.",
  "inventory.coverage.low_par.title": "Par cover is low",
  "inventory.coverage.low_par.body": "At recent usage, par covers less than about a day and a half.",
  "inventory.coverage.high_par.title": "Par cover is high",
  "inventory.coverage.high_par.body": "At recent usage, par holds eight or more days of stock.",
  "inventory.coverage.daysSummary": "Par covers about {parDays} days · Reorder at about {reorderDays} days",
  "inventory.coverage.suggestionSummary":
    "For about {parDays} days at par and {reorderDays} days at reorder: {par} {unit} par · {reorder} {unit} reorder",
  "inventory.coverage.applySuggestion": "Use suggested values"
};

function t(key: MessageKey, values?: MessageValues) {
  let text = en[key] ?? String(key);
  if (values) {
    for (const [name, value] of Object.entries(values)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("en-US", options).format(value);
}

test("coverage presentation stays learning without usage", () => {
  const presented = presentInventoryCoverageGuidance(
    t,
    formatNumber,
    buildInventoryCoverageGuidance({
      averageDailyUsage: 0,
      parLevel: 20,
      reorderThreshold: 8
    }),
    "lb"
  );
  assert.equal(presented.status, "learning");
  assert.equal(presented.daysSummary, null);
  assert.equal(presented.showApply, false);
  assert.match(presented.title, /learning/i);
});

test("coverage presentation summarizes days and offers apply when settings drift", () => {
  const presented = presentInventoryCoverageGuidance(
    t,
    formatNumber,
    buildInventoryCoverageGuidance({
      averageDailyUsage: 10,
      parLevel: 50,
      reorderThreshold: 5
    }),
    "lb"
  );
  assert.equal(presented.status, "tight_reorder");
  assert.match(presented.daysSummary ?? "", /5 days/);
  assert.match(presented.daysSummary ?? "", /0\.5 days/);
  assert.ok(presented.suggestionSummary);
  assert.equal(presented.showApply, true);
  assert.match(presented.applyLabel ?? "", /suggested/i);
});

test("coverage presentation omits apply when settings already match targets", () => {
  const presented = presentInventoryCoverageGuidance(
    t,
    formatNumber,
    buildInventoryCoverageGuidance({
      averageDailyUsage: 10,
      parLevel: 30,
      reorderThreshold: 15
    }),
    "lb"
  );
  assert.equal(presented.status, "aligned");
  assert.equal(presented.showApply, false);
  assert.equal(presented.suggestionSummary, null);
});
