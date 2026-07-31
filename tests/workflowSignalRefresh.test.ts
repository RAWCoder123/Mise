import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("hosted setup and POS CSV ingest do not re-invoke refresh_signals after Edge already refreshed", () => {
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const setup = readFileSync("services/application/setup.ts", "utf8");
  const posIngest = readFileSync("services/application/posIngest.ts", "utf8");
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");

  assert.match(repository, /workflowsRefreshOperationalSignals:\s*boolean/);
  assert.match(
    repository,
    /function createLocalDemoRepository\(\): MiseRepository \{[\s\S]*workflowsRefreshOperationalSignals:\s*false/
  );
  assert.match(
    repository,
    /function createSupabaseRepository\(\): MiseRepository \{[\s\S]*workflowsRefreshOperationalSignals:\s*true/
  );

  assert.match(edge, /action\s*===\s*"save_setup"[\s\S]*refreshWithRetry/);
  assert.match(edge, /action\s*===\s*"ingest_pos_csv"[\s\S]*refreshWithRetry/);

  assert.match(setup, /workflowsRefreshOperationalSignals/);
  assert.match(setup, /if\s*\(\s*!repository\.workflowsRefreshOperationalSignals\s*\)/);
  assert.match(setup, /regenerateOperationalSignals/);

  assert.match(posIngest, /workflowsRefreshOperationalSignals/);
  assert.match(posIngest, /if\s*\(\s*!repository\.workflowsRefreshOperationalSignals\s*\)/);
  assert.match(posIngest, /regenerateOperationalSignals/);
});
