import assert from "node:assert/strict";
import test from "node:test";

import {
  applyManualPosSalesIngestToDemoState,
  createInitialDemoState,
  DEMO_RESTAURANT_ID
} from "../services/demoData";
import {
  assertManualPosSalesIngestReady,
  buildManualPosSalesIngestPayload
} from "../services/domain/posCsvIngest";

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

test("demo state CSV ingest replaces manual rows, connects provider, and records an import", () => {
  const state = createInitialDemoState("Toast", undefined, new Date("2026-07-28T16:00:00.000Z"));
  const rows = assertManualPosSalesIngestReady(buildManualPosSalesIngestPayload(SAMPLE_CSV));

  const first = applyManualPosSalesIngestToDemoState(state, DEMO_RESTAURANT_ID, rows, "unit_test.csv");
  assert.equal(first.posSalesRowsSaved, 2);
  assert.ok(first.salesImportId);
  assert.equal(state.posProvider, "Manual CSV Upload");

  const second = applyManualPosSalesIngestToDemoState(state, DEMO_RESTAURANT_ID, rows, "unit_test.csv");
  assert.equal(second.posSalesRowsSaved, 2);

  const csvSales = state.posSales.filter((sale) => sale.source_pos === "Manual CSV Upload");
  assert.equal(csvSales.length, 2);
  assert.equal(csvSales.every((sale) => Boolean(sale.source_record_id)), true);
  assert.ok(state.posIntegrations.some((entry) => entry.provider === "manual_csv" && entry.status === "connected"));
  assert.equal(state.salesImports[0]?.import_type, "csv_upload");
  assert.equal(state.salesImports[0]?.records_processed, 2);
  assert.equal(state.auditLogs[0]?.action, "manual_pos_csv_ingested");
});
