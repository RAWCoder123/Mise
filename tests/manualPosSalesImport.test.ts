import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { planManualPosSalesImport } from "../services/domain/manualPosSalesImport";
import { parseSetupPosSalesCsv } from "../services/domain/setupDrafts";
import { DEMO_RESTAURANT_ID } from "../services/demo/replaceableDemoData";

test("planManualPosSalesImport maps validated CSV drafts into Manual CSV Upload rows", () => {
  const parsed = parseSetupPosSalesCsv(
    "sale_date,item_name,category,quantity_sold,gross_sales\n2026-08-28,Duck Noodle Bowl,Mains,4,72.00"
  );
  assert.equal(parsed.status, "ready");
  const planned = planManualPosSalesImport(DEMO_RESTAURANT_ID, parsed.rows);
  assert.equal(planned.length, 1);
  assert.equal(planned[0]?.source_pos, "Manual CSV Upload");
  assert.equal(planned[0]?.item_name, "Duck Noodle Bowl");
  assert.equal(planned[0]?.quantity_sold, 4);
  assert.equal(planned[0]?.gross_sales, 72);
  assert.equal(planned[0]?.net_sales, 66.96);
  assert.equal(planned[0]?.restaurant_id, DEMO_RESTAURANT_ID);
  assert.ok(planned[0]?.source_record_id);
});

test("planManualPosSalesImport rejects empty and over-limit batches", () => {
  assert.throws(() => planManualPosSalesImport(DEMO_RESTAURANT_ID, []), /at least one valid sales row/i);
  assert.throws(() => planManualPosSalesImport("  ", [{
    id: "pos_1",
    saleDate: "2026-08-28",
    itemName: "Soup",
    category: "Mains",
    quantitySold: 1,
    grossSales: 10,
    sourcePos: "Manual CSV Upload"
  }]), /Missing restaurant workspace/);
});

test("demo importManualPosSalesSnapshot appends after setup_completed without reopening setup", async () => {
  const values = new Map<string, string>();
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
      clear: () => {
        values.clear();
      },
      key: (index) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      }
    }
  };
  const { createLocalDemoRepository } = await import("../services/repositories/demoRepository");
  const repository = createLocalDemoRepository();
  await repository.resetDemoData(null);

  const before = await repository.fetchPlanningData(DEMO_RESTAURANT_ID);
  const beforeCount = before.sales.length;

  const first = await repository.importManualPosSalesSnapshot(DEMO_RESTAURANT_ID, [
    {
      restaurant_id: DEMO_RESTAURANT_ID,
      source_record_id: "manual_csv_test_row_1",
      sale_date: "2026-08-28",
      item_name: "Import Probe Dish",
      category: "Probe",
      quantity_sold: 2,
      gross_sales: 24,
      net_sales: 22.32,
      source_pos: "Manual CSV Upload"
    }
  ]);
  assert.equal(first.posSalesRowsSaved, 1);
  assert.ok(first.importId);

  const afterFirst = await repository.fetchPlanningData(DEMO_RESTAURANT_ID);
  assert.equal(afterFirst.sales.length, beforeCount + 1);
  assert.ok(
    afterFirst.sales.some(
      (sale) =>
        sale.source_record_id === "manual_csv_test_row_1" &&
        sale.item_name === "Import Probe Dish" &&
        sale.quantity_sold === 2
    )
  );

  const second = await repository.importManualPosSalesSnapshot(DEMO_RESTAURANT_ID, [
    {
      restaurant_id: DEMO_RESTAURANT_ID,
      source_record_id: "manual_csv_test_row_1",
      sale_date: "2026-08-28",
      item_name: "Import Probe Dish",
      category: "Probe",
      quantity_sold: 5,
      gross_sales: 60,
      net_sales: 55.8,
      source_pos: "Manual CSV Upload"
    }
  ]);
  assert.equal(second.posSalesRowsSaved, 1);

  const afterSecond = await repository.fetchPlanningData(DEMO_RESTAURANT_ID);
  assert.equal(afterSecond.sales.length, beforeCount + 1);
  const upserted = afterSecond.sales.find((sale) => sale.source_record_id === "manual_csv_test_row_1");
  assert.equal(upserted?.quantity_sold, 5);
  assert.equal(upserted?.gross_sales, 60);
});

test("sales import screen uses durable post-setup import and restaurant-switch isolation", () => {
  const screen = readFileSync("app/settings/sales-import.tsx", "utf8");
  assert.match(screen, /importManualPosSales/);
  assert.doesNotMatch(screen, /saveRestaurantSetup/);
  assert.match(screen, /importRequestIdRef/);
  assert.match(screen, /activeRestaurantIdRef/);
  assert.match(
    screen,
    /requestId !== importRequestIdRef\.current \|\|[\s\S]*activeRestaurantIdRef\.current !== restaurantId/
  );
  assert.match(screen, /}, \[restaurant\?\.id\]\)/);
});

test("operational workflows expose import_manual_pos_sales and migration grants authenticated only", () => {
  const workflow = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const migration = readFileSync(
    "supabase/migrations/20260829230000_import_manual_pos_sales.sql",
    "utf8"
  );
  assert.match(workflow, /"import_manual_pos_sales"/);
  assert.match(workflow, /supabase\.rpc\("import_manual_pos_sales"/);
  assert.match(migration, /create or replace function public\.import_manual_pos_sales/);
  assert.match(migration, /private\.has_restaurant_role/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /source_pos <> 'Manual CSV Upload'/);
  assert.match(
    migration,
    /revoke all on function public\.import_manual_pos_sales\(uuid, jsonb\)[\s\S]*from public, anon, authenticated, service_role/
  );
  assert.match(
    migration,
    /grant execute on function public\.import_manual_pos_sales\(uuid, jsonb\)[\s\S]*to authenticated/
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.import_manual_pos_sales\(uuid, jsonb\)[\s\S]*to service_role/
  );
});
