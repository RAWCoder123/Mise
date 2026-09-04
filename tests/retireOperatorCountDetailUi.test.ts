import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("inventory detail no longer queues direct operator counts", () => {
  const detail = readFileSync("app/inventory/[id].tsx", "utf8");
  const validation = readFileSync("services/miseValidation.ts", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(detail, /type InventoryOperatorAction = "receipt" \| "waste" \| "stockout"/);
  assert.doesNotMatch(detail, /value:\s*"count"/);
  assert.match(detail, /router\.push\("\/inventory\/count"\)/);
  assert.match(detail, /inventory\.ops\.countSession\.cta/);
  assert.match(detail, /setOperation\("receipt"\)/);

  assert.match(
    validation,
    /Physical counts are intentionally excluded[\s\S]*operatorInventoryEventTypes[\s\S]*"receipt"[\s\S]*"waste"[\s\S]*"stockout"/
  );
  assert.doesNotMatch(
    validation,
    /const operatorInventoryEventTypes = new Set<InventoryEventType>\(\[\s*"receipt",\s*"count"/
  );

  assert.match(catalog, /"inventory\.ops\.countSession\.cta": "Open count session"/);
  assert.match(catalog, /"inventory\.ops\.countSession\.cta": "Abrir sesión de conteo"/);
  assert.match(catalog, /"inventory\.ops\.countSession\.cta": "打开盘点会话"/);
});
