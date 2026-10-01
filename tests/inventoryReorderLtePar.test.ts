import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260903210000_inventory_reorder_lte_par.sql",
  "utf8"
);
const schema = readFileSync("supabase/schema.sql", "utf8");
const validation = readFileSync("services/miseValidation.ts", "utf8");
const application = readFileSync("services/application/inventory.ts", "utf8");
const edgeWorkflow = readFileSync(
  "supabase/functions/operational-workflows/index.ts",
  "utf8"
);
const demoRepository = readFileSync(
  "services/repositories/demoRepository.ts",
  "utf8"
);
const inventoryDetail = readFileSync("app/inventory/[id].tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

test("migration clamps inverted rows and enforces reorder <= par", () => {
  assert.match(
    migration,
    /set\s+reorder_threshold\s*=\s*item\.par_level[\s\S]*where\s+item\.reorder_threshold\s*>\s*item\.par_level/i
  );
  assert.match(
    migration,
    /add\s+constraint\s+inventory_items_reorder_lte_par[\s\S]*check\s*\(\s*reorder_threshold\s*<=\s*par_level\s*\)/i
  );
  assert.match(
    migration,
    /if\s+item_row\.reorder_threshold\s*>\s*item_row\.par_level\s+then[\s\S]*Reorder threshold cannot exceed par level/i
  );
  assert.match(
    migration,
    /safe_patch\s*-\s*array\['par_level',\s*'reorder_threshold'\]/i
  );
  assert.doesNotMatch(migration, /current_quantity/i);
});

test("schema pins reorder <= par for greenfield installs", () => {
  assert.match(
    schema,
    /inventory_items_reorder_lte_par[\s\S]*reorder_threshold\s*<=\s*par_level/i
  );
});

test("client, edge, and demo reject inverted inventory policy pairs", () => {
  assert.match(validation, /export function requireInventoryPolicyPair/i);
  assert.match(
    validation,
    /requireInventoryPolicyPair\(validated\.par_level,\s*validated\.reorder_threshold\)/i
  );
  assert.match(
    application,
    /requireInventoryPolicyPair\(updatedForPlanning\.par_level,\s*updatedForPlanning\.reorder_threshold\)/i
  );
  assert.match(
    edgeWorkflow,
    /normalized\.reorder_threshold\s*>\s*normalized\.par_level[\s\S]*Reorder threshold cannot exceed par level/i
  );
  assert.match(
    demoRepository,
    /if\s*\(\s*nextReorder\s*>\s*nextPar\s*\)[\s\S]*Reorder threshold cannot exceed par level/i
  );
  assert.match(inventoryDetail, /inventory\.detail\.reorderExceedsPar/);
  assert.match(catalog, /"inventory\.detail\.reorderExceedsPar"/);
  assert.equal(
    (catalog.match(/"inventory\.detail\.reorderExceedsPar"/g) ?? []).length,
    3
  );
});
