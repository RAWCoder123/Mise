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
