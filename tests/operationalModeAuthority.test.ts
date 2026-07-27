import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260727223000_enforce_emergency_operational_mode.sql",
  "utf8"
);
const rlsMigration = readFileSync(
  "supabase/migrations/20260727224500_operational_mode_history_rls.sql",
  "utf8"
);
const incident = readFileSync("docs/operations/INCIDENT_RESPONSE.md", "utf8");

test("read-only and emergency modes block authenticated public-table mutations", () => {
  assert.match(migration, /auth\.uid\(\) is null[\s\S]*return new/i);
  assert.match(migration, /current_mode in \('read_only', 'emergency'\)/i);
  assert.match(migration, /before insert or update or delete on public\./i);
  assert.match(migration, /table_name <> 'system_operational_controls'/i);
  assert.match(migration, /errcode = '55000'/i);
});

test("system mode changes are service-only, replay-safe, and append-only", () => {
  assert.match(migration, /create table if not exists private\.operational_mode_changes/i);
  assert.match(migration, /request_id uuid not null unique/i);
  assert.match(migration, /operational_mode_changes_append_only/i);
  assert.match(migration, /service_set_system_operational_mode/i);
  assert.match(migration, /grant execute[\s\S]*to service_role/i);
  assert.match(migration, /revoke all[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /Operational mode request conflicts/i);
  assert.match(rlsMigration, /enable row level security/i);
  assert.match(rlsMigration, /grant select[\s\S]*to service_role/i);
});

test("incident procedures use the audited service transition and require normal-mode proof", () => {
  assert.match(incident, /service_set_system_operational_mode/);
  assert.match(incident, /service-role-only/i);
  assert.match(incident, /verify.*normal/i);
});
