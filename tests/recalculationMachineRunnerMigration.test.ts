import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20261008140000_recalculation_machine_runner.sql", import.meta.url),
  "utf8"
);

const edge = readFileSync(
  new URL("../supabase/functions/run-scheduled-recalculations/index.ts", import.meta.url),
  "utf8"
);

const config = readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8");

test("machine runner migration separates member and machine ledger authority", () => {
  assert.match(migration, /recorded_source text not null default 'member'/i);
  assert.match(migration, /recorded_source in \('member', 'machine'\)/i);
  assert.match(migration, /recorded_source = 'machine' and recorded_by is null/i);
  assert.match(migration, /alter column recorded_by drop not null/i);

  assert.match(migration, /create or replace function public\.service_record_machine_recalculation_run/i);
  assert.match(migration, /recorded_source\s*\)\s*values[\s\S]*null,\s*'machine'/i);
  assert.match(migration, /private\.system_operational_mode_blocks_writes\(\)/i);
  assert.match(migration, /errcode = '55000'/);

  assert.match(migration, /create or replace function public\.service_list_recalculation_runner_targets/i);
  assert.match(migration, /create or replace function public\.service_resolve_recalculation_signal_actor/i);
  assert.match(
    migration,
    /membership\.role in \('owner', 'admin', 'manager'\)/i
  );

  const grants = migration.match(/grant execute on function[\s\S]*?;/gi) ?? [];
  assert.ok(grants.length >= 3);
  for (const grant of grants) {
    assert.match(grant, /to service_role;/i);
    assert.doesNotMatch(grant, /authenticated/i);
    assert.doesNotMatch(grant, /\banon\b/i);
  }

  assert.match(
    migration,
    /revoke all on function public\.service_record_machine_recalculation_run[\s\S]*from public, anon, authenticated, service_role/i
  );
});

test("the Edge runner authenticates with a dedicated secret before loading service credentials", () => {
  assert.match(config, /\[functions\.run-scheduled-recalculations\]\s*verify_jwt\s*=\s*false/i);
  assert.match(edge, /await requireRunnerSecret\(req\);/);
  assert.match(edge, /MISE_RECALCULATION_RUNNER_SECRET/);
  assert.match(edge, /x-mise-recalculation-secret/);
  assert.match(edge, /createServiceClient\(\)/);
  assert.ok(
    edge.indexOf("await requireRunnerSecret(req);") < edge.indexOf("createServiceClient()")
  );
  assert.match(edge, /service_record_machine_recalculation_run/);
  assert.match(edge, /service_list_recalculation_runner_targets/);
  assert.match(edge, /service_resolve_recalculation_signal_actor/);
  assert.doesNotMatch(edge, /requireAuthenticatedContext/);
});
