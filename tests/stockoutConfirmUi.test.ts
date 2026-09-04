import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const screen = readFileSync("app/inventory/[id].tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

test("inventory detail requires Alert confirmation before queuing a stockout", () => {
  assert.match(screen, /Alert,\s*StyleSheet/);
  assert.match(screen, /function confirmStockoutThenSubmit\(/);
  assert.match(screen, /if \(operation === "stockout"\) \{\s*confirmStockoutThenSubmit\(item, payload\);\s*return;/);
  assert.match(screen, /Alert\.alert\(\s*t\("inventory\.ops\.stockoutConfirm\.title"\)/);
  assert.match(screen, /t\("inventory\.ops\.stockoutConfirm\.body"/);
  assert.match(screen, /formatNumber\(stockItem\.current_quantity/);
  assert.match(screen, /text: t\("common\.cancel"\), style: "cancel"/);
  assert.match(
    screen,
    /text: t\("inventory\.ops\.stockoutConfirm\.action"\),\s*style: "destructive"/
  );
  assert.match(screen, /onPress: \(\) => \{\s*void runQueuedInventoryOperation\(payload\);\s*\}/);
  assert.match(screen, /async function runQueuedInventoryOperation\(/);
  assert.match(screen, /await queueInventoryOperation\(\{/);
  assert.match(screen, /eventType: payload\.eventType/);
  assert.match(screen, /quantity: payload\.quantity/);
});

test("stockout confirmation copy exists in English, Spanish, and Simplified Chinese", () => {
  for (const key of [
    "inventory.ops.stockoutConfirm.title",
    "inventory.ops.stockoutConfirm.body",
    "inventory.ops.stockoutConfirm.action"
  ] as const) {
    const matches = catalog.match(new RegExp(`"${key.replace(/\./g, "\\.")}":`, "g")) ?? [];
    assert.equal(matches.length, 3, `${key} must exist once per locale`);
  }

  assert.match(catalog, /"inventory\.ops\.stockoutConfirm\.body": "This sets on-hand to zero for \{item\}\./);
  assert.match(catalog, /"inventory\.ops\.stockoutConfirm\.body": "Esto pone en cero el inventario de \{item\}\./);
  assert.match(catalog, /"inventory\.ops\.stockoutConfirm\.body": "这会将 \{item\} 的在库数量设为零。/);
});

test("stockout submit still keeps the non-blocking caution notice", () => {
  assert.match(screen, /operation === "stockout" \? \(/);
  assert.match(screen, /t\("inventory\.ops\.stockoutNotice\.title"\)/);
  assert.match(screen, /t\("inventory\.ops\.stockoutNotice\.body"\)/);
});
