import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("close recalculation no longer truncates ledger history to a 14-day window", () => {
  const source = read("services/application/recalculations.ts");
  assert.match(source, /CLOSE_RECONCILIATION_LEDGER_LIMIT\s*=\s*2000/);
  assert.doesNotMatch(source, /CLOSE_LEDGER_LOOKBACK_DAYS/);
  assert.doesNotMatch(source, /addDaysToDateKey\([\s\S]*CLOSE/);
  assert.match(source, /ledgerComplete:\s*events\.length\s*<\s*CLOSE_RECONCILIATION_LEDGER_LIMIT/);
  assert.match(source, /enrichInsightsWithCloseReconciliation/);
  assert.match(
    source,
    /replaceOperationalSignals\([\s\S]*\{\s*cycle:\s*options\.cycle\s*\}/
  );
});

test("hosted replaceOperationalSignals forwards close cycle into Edge refresh", () => {
  const repository = read("services/repositories/supabaseRepository.ts");
  assert.match(
    repository,
    /replaceOperationalSignals\(restaurantId,\s*_recommendations,\s*_insights,\s*options\)/
  );
  assert.match(repository, /action:\s*"refresh_signals"/);
  assert.match(repository, /\.\.\.\(options\?\.cycle\s*\?\s*\{\s*cycle:\s*options\.cycle\s*\}\s*:\s*\{\}\)/);
});

test("Edge refresh_signals merges close reconciliation before committing insights", () => {
  const edge = read("supabase/functions/operational-workflows/index.ts");
  assert.match(edge, /enrichInsightsWithCloseReconciliation/);
  assert.match(edge, /resolveInsightRowsForCommit/);
  assert.match(edge, /fetchCloseReconciliationLedger/);
  assert.match(edge, /cycle === "close"/);
  assert.match(edge, /CLOSE_RECONCILIATION_LEDGER_LIMIT\s*=\s*2000/);
  assert.match(edge, /\.from\("inventory_events"\)/);
  // Must not keep the old pattern of mapping ordinary signals only without close merge.
  assert.match(edge, /action === "refresh_signals" && body\.cycle != null/);
});

test("repository contract documents the close-cycle options surface", () => {
  const contracts = read("services/repositories/repositoryContracts.ts");
  assert.match(
    contracts,
    /replaceOperationalSignals\([\s\S]*options\?:\s*\{\s*cycle\?:\s*"daily_open"\s*\|\s*"mid_shift"\s*\|\s*"close"\s*\}/
  );
});
