import assert from "node:assert/strict";
import test from "node:test";

import {
  assertManualPosSalesIngestReady,
  buildManualPosSalesIngestPayload
} from "../services/domain/posCsvIngest";
import { createMiseRepository } from "../services/repositories/miseRepository";
import { resetDemoStore } from "../services/localStore";
import { DEMO_RESTAURANT_ID } from "../services/demoData";

const SAMPLE_CSV = [
  "sale_date,item_name,category,quantity_sold,gross_sales",
  "2026-07-28,General Tso Chicken,Entrees,42,630",
  "2026-07-28,Dumplings,Appetizers,18,162"
].join("\n");

test("manual POS CSV ingest payload validates and maps net sales", () => {
  const payload = buildManualPosSalesIngestPayload(SAMPLE_CSV);
  assert.equal(payload.status, "ready");
  assert.equal(payload.acceptedRowCount, 2);
  assert.equal(payload.rows[0]?.source_pos, "Manual CSV Upload");
  assert.equal(payload.rows[0]?.net_sales, 585.9);
  assert.equal(assertManualPosSalesIngestReady(payload).length, 2);
});

test("manual POS CSV ingest rejects invalid or empty rows", () => {
  const empty = buildManualPosSalesIngestPayload("");
  assert.throws(() => assertManualPosSalesIngestReady(empty), /at least one valid POS sales row/i);

  const invalid = buildManualPosSalesIngestPayload(
    ["sale_date,item_name,category,quantity_sold,gross_sales", "bad-date,,Entrees,-1,-5"].join("\n")
  );
  assert.equal(invalid.status, "needs_review");
  assert.throws(() => assertManualPosSalesIngestReady(invalid), /validation issues/i);
});

test("demo repository imports manual CSV sales idempotently and records an import", async () => {
  await resetDemoStore("Toast");
  const repository = createMiseRepository();
  const payload = buildManualPosSalesIngestPayload(SAMPLE_CSV);
  const rows = assertManualPosSalesIngestReady(payload);

  const first = await repository.importManualPosSalesCsv(DEMO_RESTAURANT_ID, rows, "unit_test.csv");
  assert.equal(first.posSalesRowsSaved, 2);
  assert.ok(first.salesImportId);

  const second = await repository.importManualPosSalesCsv(DEMO_RESTAURANT_ID, rows, "unit_test.csv");
  assert.equal(second.posSalesRowsSaved, 2);

  const planning = await repository.fetchPlanningData(DEMO_RESTAURANT_ID);
  const csvSales = planning.sales.filter((sale) => sale.source_pos === "Manual CSV Upload");
  assert.equal(csvSales.length, 2);
  assert.equal(csvSales.every((sale) => Boolean(sale.source_record_id)), true);

  const status = await repository.fetchPOSStatus(DEMO_RESTAURANT_ID);
  assert.equal(status.provider, "Manual CSV Upload");

  const integrations = await repository.fetchPosIntegrations(DEMO_RESTAURANT_ID);
  assert.ok(integrations.some((entry) => entry.provider === "manual_csv" && entry.status === "connected"));
});
