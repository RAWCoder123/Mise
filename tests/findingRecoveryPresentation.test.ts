import assert from "node:assert/strict";
import test from "node:test";

import type { OperationalFinding } from "../services/domain/operationalFindings";
import {
  formatFindingMissingDataLabels,
  presentFindingMissingDataLabels,
  presentFindingRecoveryActions
} from "../services/presentation/findingRecoveryPresentation";

function sampleFinding(
  overrides: Partial<OperationalFinding> = {}
): Pick<OperationalFinding, "evidence" | "freshness" | "affectedWorkflow" | "category"> {
  return {
    category: "ordering",
    affectedWorkflow: "inventory_and_ordering",
    evidence: [
      {
        type: "purchase_recommendation",
        id: "rec-1",
        observedAt: "2026-08-31T12:00:00.000Z",
        summary: "Basil: 2 cases suggested"
      },
      {
        type: "inventory_item",
        id: "item-basil",
        observedAt: "2026-08-31T10:00:00.000Z",
        summary: "Basil on hand"
      }
    ],
    freshness: {
      state: "incomplete",
      asOf: "2026-08-31T10:00:00.000Z",
      staleAfter: "2026-09-02T10:00:00.000Z",
      missingData: ["verified_physical_count", "verified_canonical_unit", "menu_mapping"]
    },
    ...overrides
  };
}

test("finding recovery prioritizes count, item unit, and recipe gaps without duplicate hrefs", () => {
  const actions = presentFindingRecoveryActions(sampleFinding());

  assert.deepEqual(
    actions.map((action) => ({ href: action.href, reason: action.reason })),
    [
      { href: "/inventory/count", reason: "verified_physical_count" },
      { href: "/inventory/item-basil", reason: "verified_canonical_unit" },
      { href: "/settings/recipes", reason: "menu_mapping" }
    ]
  );
});

test("finding recovery deep-links sales and inventory setup data gaps", () => {
  const sales = presentFindingRecoveryActions(
    sampleFinding({
      category: "data_quality",
      affectedWorkflow: "daily_sales_import",
      evidence: [
        {
          type: "data_gap",
          id: "sales:2026-08-31",
          observedAt: "2026-08-31T00:00:00.000Z",
          summary: "No sales rows"
        }
      ],
      freshness: {
        state: "incomplete",
        asOf: "2026-08-31T12:00:00.000Z",
        staleAfter: "2026-09-02T12:00:00.000Z",
        missingData: ["daily_sales"]
      }
    })
  );
  assert.equal(sales[0]?.href, "/settings/sales-import");
  assert.equal(sales[0]?.labelKey, "dailyBrief.recovery.salesImport");

  const inventorySetup = presentFindingRecoveryActions(
    sampleFinding({
      category: "data_quality",
      affectedWorkflow: "inventory_setup",
      evidence: [
        {
          type: "data_gap",
          id: "inventory:restaurant-a",
          observedAt: "2026-08-31T00:00:00.000Z",
          summary: "No inventory"
        }
      ],
      freshness: {
        state: "incomplete",
        asOf: "2026-08-31T12:00:00.000Z",
        staleAfter: "2026-09-02T12:00:00.000Z",
        missingData: ["inventory_items"]
      }
    })
  );
  assert.equal(inventorySetup[0]?.href, "/setup");
  assert.equal(inventorySetup[0]?.labelKey, "dailyBrief.recovery.setup");
});

test("complete findings still recover through typed evidence and workflow", () => {
  const actions = presentFindingRecoveryActions(
    sampleFinding({
      freshness: {
        state: "fresh",
        asOf: "2026-08-31T10:00:00.000Z",
        staleAfter: "2026-09-02T10:00:00.000Z",
        missingData: []
      }
    })
  );

  assert.deepEqual(
    actions.map((action) => action.href),
    ["/orders", "/inventory/item-basil"]
  );
});

test("named menu mapping gaps localize without inventing recovery routes", () => {
  const labels = presentFindingMissingDataLabels([
    "menu_mapping:Basil pesto",
    "verified_physical_count",
    "menu_mapping:Basil pesto",
    "unknown_gap_code"
  ]);

  assert.deepEqual(labels, [
    {
      kind: "mapping",
      labelKey: "dailyBrief.missing.menu_mapping_named",
      name: "Basil pesto"
    },
    { kind: "known", labelKey: "dailyBrief.missing.verified_physical_count" },
    { kind: "raw", code: "unknown_gap_code" }
  ]);

  const formatted = formatFindingMissingDataLabels(
    ["verified_canonical_unit", "menu_mapping:Olive oil"],
    (key, values) => {
      if (key === "dailyBrief.missing.verified_canonical_unit") return "Verified unit";
      if (key === "dailyBrief.missing.menu_mapping_named") {
        return `Recipe mapping: ${values?.name ?? ""}`;
      }
      return key;
    }
  );
  assert.equal(formatted, "Verified unit, Recipe mapping: Olive oil");
});

test("unmapped sale findings recover through recipes workflow", () => {
  const actions = presentFindingRecoveryActions(
    sampleFinding({
      category: "data_quality",
      affectedWorkflow: "recipe_mapping",
      evidence: [
        {
          type: "pos_sale",
          id: "sale-1",
          observedAt: "2026-08-31T18:00:00.000Z",
          summary: "Margherita sold without mapping"
        }
      ],
      freshness: {
        state: "incomplete",
        asOf: "2026-08-31T18:00:00.000Z",
        staleAfter: "2026-09-02T18:00:00.000Z",
        missingData: ["menu_mapping:Margherita"]
      }
    })
  );

  assert.equal(actions.length, 1);
  assert.equal(actions[0]?.href, "/settings/recipes");
  assert.equal(actions[0]?.reason, "menu_mapping");
});
