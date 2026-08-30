import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  RECOMMENDATION_HISTORY_DAYS,
  recommendationHistoryCutoffIso
} from "../services/repositories/repositoryContracts";

test("recommendation history cutoff matches the learned-quantity lookback window", () => {
  assert.equal(RECOMMENDATION_HISTORY_DAYS, 180);

  const now = Date.parse("2026-07-21T12:00:00.000Z");
  const cutoff = recommendationHistoryCutoffIso(now);
  assert.equal(cutoff, new Date(now - 180 * 24 * 60 * 60 * 1000).toISOString());

  // The domain's learned-quantity window must never look back further than
  // the repository fetch bound, or learned quantities would silently degrade.
  const domain = readFileSync("services/domain/miseDomain.ts", "utf8");
  assert.match(domain, /now - 180 \* 24 \* 60 \* 60 \* 1000/);
});

test("both repository backends bound recommendation history reads", () => {
  const hosted = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
  const demo = readFileSync("services/repositories/demoRepository.ts", "utf8");

  const hostedMethod = hosted.match(/async fetchRecommendationHistory\([\s\S]*?\n    \},/)?.[0] ?? "";
  assert.match(hostedMethod, /\.from\("purchase_recommendations"\)/);
  assert.match(hostedMethod, /\.eq\("restaurant_id", restaurantId\)/);
  assert.match(hostedMethod, /\.gte\("created_at", recommendationHistoryCutoffIso\(\)\)/);

  const demoMethod = demo.match(/async fetchRecommendationHistory\([\s\S]*?\n    \},/)?.[0] ?? "";
  assert.match(demoMethod, /recommendation\.restaurant_id === restaurantId/);
  assert.match(demoMethod, /recommendation\.created_at >= cutoff/);
});

test("both repository backends bound and tenant-scope supplier delivery history", () => {
  const hosted = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
  const demo = readFileSync("services/repositories/demoRepository.ts", "utf8");

  const hostedMethod = hosted.match(/async fetchSupplierDeliveryHistory\([\s\S]*?\n    \},/)?.[0] ?? "";
  assert.match(hostedMethod, /\.from\("supplier_deliveries"\)/);
  assert.match(hostedMethod, /\.eq\("restaurant_id", restaurantId\)/);
  assert.match(hostedMethod, /\.limit\(100\)/);
  assert.match(hostedMethod, /\.from\("supplier_delivery_items"\)/);
  assert.match(hostedMethod, /\.limit\(1000\)/);

  const demoMethod = demo.match(/async fetchSupplierDeliveryHistory\([\s\S]*?\n    \},/)?.[0] ?? "";
  assert.match(demoMethod, /delivery\.restaurant_id === restaurantId/);
  assert.match(demoMethod, /item\.restaurant_id === restaurantId/);
  assert.match(demoMethod, /\.slice\(0, 100\)/);
  assert.match(demoMethod, /\.slice\(0, 1000\)/);
});

test("recompute paths use the bounded history fetch instead of full recommendation scans", () => {
  const recalculations = readFileSync("services/application/recalculations.ts", "utf8");
  const inventory = readFileSync("services/application/inventory.ts", "utf8");

  for (const source of [recalculations, inventory]) {
    assert.match(source, /repository\.fetchRecommendationHistory\(restaurantId\)/);
    assert.doesNotMatch(source, /fetchPurchaseRecommendations\(restaurantId,\s*"all"\)/);
  }
});

test("repository facade keeps demo and hosted backends behind one stable entry point", () => {
  const facade = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const applicationSeam = readFileSync("services/application/repository.ts", "utf8");

  assert.match(facade, /export \* from "\.\/repositoryContracts"/);
  assert.match(facade, /isSupabaseConfigured && supabase \? createSupabaseRepository\(\) : createLocalDemoRepository\(\)/);
  assert.match(applicationSeam, /export function setMiseRepositoryForTesting/);
  assert.match(applicationSeam, /new Proxy/);
});

test("waste analysis reads a tenant-scoped and bounded ledger window", () => {
  const application = readFileSync("services/application/waste.ts", "utf8");

  assert.match(application, /repository\.fetchRestaurant\(normalizedRestaurantId\)/);
  assert.match(application, /repository\.fetchInventoryItems\(normalizedRestaurantId\)/);
  assert.match(application, /repository\.listInventoryEvents\(normalizedRestaurantId/);
  assert.match(application, /eventTypes: \["waste", "correction"\]/);
  assert.match(application, /limit: WASTE_HISTORY_LIMIT/);
  assert.match(application, /historyTruncated: events\.length === WASTE_HISTORY_LIMIT/);
});

test("item ledger history filters by inventory item and reports truncation", () => {
  const evidence = readFileSync("services/application/inventoryEvidence.ts", "utf8");
  const hosted = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
  const demo = readFileSync("services/repositories/demoRepository.ts", "utf8");
  const contracts = readFileSync("services/repositories/repositoryContracts.ts", "utf8");

  assert.match(contracts, /inventoryItemId\?: string/);
  assert.match(evidence, /ITEM_LEDGER_HISTORY_LIMIT = 40/);
  assert.match(evidence, /inventoryItemId: normalizedItemId/);
  assert.match(evidence, /truncated: events\.length === limit/);

  const hostedMethod = hosted.match(/async listInventoryEvents\([\s\S]*?\n    \},/)?.[0] ?? "";
  assert.match(hostedMethod, /\.eq\("inventory_item_id", options\.inventoryItemId\)/);

  const demoMethod = demo.match(/async function listInventoryEvents\([\s\S]*?\n  async function recordInventoryEvent/)?.[0] ?? "";
  assert.match(demoMethod, /event\.inventoryItemId === inventoryItemId/);
});

test("phase briefs compose only verified screen-safe operational facades", () => {
  const application = readFileSync("services/application/dailyPhaseBrief.ts", "utf8");

  assert.match(application, /fetchDailyOperatingPlan\(normalizedRestaurantId/);
  assert.match(application, /fetchOperatingBrief\(normalizedRestaurantId\)/);
  assert.match(application, /fetchDailyOpsReport\(normalizedRestaurantId\)/);
  assert.match(application, /buildDailyPhaseBriefs\(/);
  assert.doesNotMatch(application, /OpenAI|generateText|answerAskMise/);
});

test("both repository backends bound and tenant-scope the recalculation run ledger", () => {
  const hosted = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
  const demo = readFileSync("services/repositories/demoRepository.ts", "utf8");

  const hostedRead = hosted.match(/async listRecalculationRuns\([\s\S]*?\n    \},/)?.[0] ?? "";
  assert.match(hostedRead, /\.from\("recalculation_runs"\)/);
  assert.match(hostedRead, /\.eq\("restaurant_id", restaurantId\)/);
  assert.match(hostedRead, /\.limit\(options\.limit \?\? 64\)/);
  assert.match(hostedRead, /failed restaurant scope validation/);

  // Writes are RPC-only; a client insert into the append-only ledger would
  // bypass the replay guard and the activity trigger.
  const hostedWrite = hosted.match(/async recordRecalculationRun\([\s\S]*?\n    \},/)?.[0] ?? "";
  assert.match(hostedWrite, /client\.rpc\(\s*"record_recalculation_run"/);
  assert.doesNotMatch(hostedWrite, /\.insert\(/);
  assert.match(hostedWrite, /failed restaurant scope validation/);

  const demoRead = demo.match(/async listRecalculationRuns\([\s\S]*?\n    \},/)?.[0] ?? "";
  assert.match(demoRead, /run\.restaurantId === restaurantId/);
  assert.match(demoRead, /options\.limit \?\? 64/);

  // Demo parity must re-assert the same invariants the RPC enforces.
  const demoWrite = demo.match(/async recordRecalculationRun\([\s\S]*?\n    \},/)?.[0] ?? "";
  assert.match(demoWrite, /requireActiveDemoRestaurant/);
  assert.match(demoWrite, /already recorded a different attempt/);
  assert.match(demoWrite, /attempt is out of range/);
  assert.match(demoWrite, /fromRecalculationRunActivity/);
});
