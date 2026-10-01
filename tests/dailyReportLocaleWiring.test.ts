import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("fetchDailyOpsReport accepts an operator locale for Ask Mise briefing", () => {
  const application = readFileSync("services/application/dailyReport.ts", "utf8");
  assert.match(application, /FetchDailyOpsReportOptions/);
  assert.match(application, /locale\?: AppLocale/);
  assert.match(application, /options\?\.locale \?\? "en"/);
  assert.match(application, /translate\(locale, key, values\)/);
  assert.doesNotMatch(application, /locale: "en"/);
});

test("Daily Report screen passes locale into fetchDailyOpsReport", () => {
  const screen = readFileSync("app/more/daily-report.tsx", "utf8");
  assert.match(screen, /fetchDailyOpsReport\(restaurantId, \{ locale \}\)/);
  assert.match(screen, /presentDailyReportMemory/);
});
