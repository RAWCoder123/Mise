import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeInventoryItemPatch,
  requireInventoryItemPatch,
  requireInventoryPurchaseUnit
} from "../services/miseValidation";

const tipMigration = readFileSync(
  "supabase/migrations/20260901170000_inventory_purchase_unit_policy_patch.sql",
  "utf8"
);
const edgeWorkflow = readFileSync(
  "supabase/functions/operational-workflows/index.ts",
  "utf8"
);
const inventoryDetail = readFileSync("app/inventory/[id].tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");
const demoRepository = readFileSync(
  "services/repositories/demoRepository.ts",
  "utf8"
);

test("purchase-unit policy patch allows unit without current_quantity or supplier_name", () => {
  assert.match(
    tipMigration,
    /safe_patch\s*-\s*array\['par_level',\s*'reorder_threshold',\s*'unit'\]/i
  );
  assert.match(tipMigration, /item_row\.unit\s*:=\s*next_unit/i);
  assert.match(
    tipMigration,
    /set\s+par_level\s*=\s*item_row\.par_level[\s\S]*unit\s*=\s*item_row\.unit/i
  );
  assert.doesNotMatch(tipMigration, /current_quantity/i);
  assert.doesNotMatch(
    tipMigration,
    /safe_patch\s*-\s*array\[[^\]]*'supplier_name'/i
  );
  assert.doesNotMatch(tipMigration, /\bsupplier_name\s*=/i);
  assert.match(
    tipMigration,
    /char_length\(next_unit\)\s+not between 1 and 40/i
  );
});

test("edge inventory patch allowlist includes bounded unit", () => {
  assert.match(
    edgeWorkflow,
    /new Set\(\["par_level", "reorder_threshold", "unit"\]\)/i
  );
  assert.match(
    edgeWorkflow,
    /normalized\.unit\s*=\s*unit/i
  );
  assert.match(
    edgeWorkflow,
    /requireBoundedString\(patch\.unit,\s*"unit",\s*40\)\.trim\(\)/i
  );
  assert.doesNotMatch(edgeWorkflow, /new Set\([^\n]+supplier_name/i);
});

test("requireInventoryItemPatch accepts and normalizes purchase unit", () => {
  assert.deepEqual(requireInventoryItemPatch({ unit: "  lb  " }), { unit: "lb" });
  assert.deepEqual(requireInventoryItemPatch({ unit: "fl   oz", par_level: 12 }), {
    unit: "fl oz",
    par_level: 12
  });
  assert.equal(requireInventoryPurchaseUnit("case"), "case");
  assert.throws(() => requireInventoryPurchaseUnit(""), /Purchase unit must be between/);
  assert.throws(
    () => requireInventoryPurchaseUnit("x".repeat(41)),
    /Purchase unit must be between/
  );
  assert.throws(
    () => requireInventoryItemPatch({ current_quantity: 1, unit: "lb" }),
    /remain auditable/
  );
  assert.deepEqual(normalizeInventoryItemPatch({ unit: " lbs " }), { unit: "lbs" });
});

test("inventory detail exposes purchase-unit correction controls", () => {
  assert.match(inventoryDetail, /inventory\.detail\.purchaseUnit/);
  assert.match(inventoryDetail, /unit:\s*purchaseUnit\.trim\(\)/);
  assert.match(inventoryDetail, /validatePurchaseUnit/);
  assert.match(catalog, /"inventory\.detail\.purchaseUnit":/);
  assert.match(catalog, /"inventory\.detail\.purchaseUnitHint":/);
  assert.match(catalog, /"inventory\.detail\.field\.purchaseUnit":/);
});

test("demo inventory unit patches re-normalize canonical conversion", () => {
  const method =
    demoRepository.match(
      /async\s+updateInventoryItemAndSignals\([\s\S]*?\n\s{4}\},/
    )?.[0] ?? "";
  assert.match(method, /applyDemoPurchaseUnitCanonicalNormalization/);
  assert.match(
    demoRepository,
    /function\s+applyDemoPurchaseUnitCanonicalNormalization/
  );
  assert.match(
    demoRepository,
    /normalizeOperationalQuantity\(\{\s*quantity:\s*1,\s*unit:\s*item\.unit\s*\}\)/
  );
});
