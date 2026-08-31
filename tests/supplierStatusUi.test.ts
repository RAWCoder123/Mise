import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("supplier status screen is wired through More and Daily Brief routes", () => {
  const screen = readFileSync("app/more/supplier-status.tsx", "utf8");
  const more = readFileSync("app/(tabs)/more.tsx", "utf8");
  const layout = readFileSync("app/_layout.tsx", "utf8");
  const dailyReport = readFileSync("app/more/daily-report.tsx", "utf8");
  const brief = readFileSync("services/domain/dailyPhaseBrief.ts", "utf8");

  assert.match(screen, /fetchSupplierReliabilitySummary/);
  assert.match(screen, /partitionSupplierStatusSections/);
  assert.match(screen, /primarySupplierFollowUpOrderId/);
  assert.match(screen, /flow: "supplier_status"/);
  assert.match(more, /more\.row\.supplierStatus\.title/);
  assert.match(more, /\/more\/supplier-status/);
  assert.match(layout, /more\/supplier-status/);
  assert.match(dailyReport, /\/more\/supplier-status/);
  assert.match(brief, /"\/more\/supplier-status"/);
  assert.match(brief, /route: "\/more\/supplier-status"/);
});
