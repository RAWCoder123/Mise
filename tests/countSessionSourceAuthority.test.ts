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
    validation.slice(validation.indexOf("operatorInventoryEventTypes")),
    /"count"/
  );

  assert.match(catalog, /"inventory\.ops\.countSession\.title":/);
  assert.match(catalog, /"inventory\.ops\.countSession\.cta":/);
});

test("hosted and domain count inserts require approve_count_session source", () => {
  const migration = readFileSync(
    "supabase/migrations/20260904100000_inventory_count_session_source_authority.sql",
    "utf8"
  );
  const ledger = readFileSync("services/domain/inventoryLedger.ts", "utf8");

  assert.match(migration, /enforce_inventory_count_session_source/);
  assert.match(migration, /approve_count_session/);
  assert.match(migration, /Inventory counts must come from an approved count session/);
  assert.match(ledger, /count_requires_session/);
  assert.match(ledger, /INVENTORY_COUNT_SESSION_SOURCE/);
});
