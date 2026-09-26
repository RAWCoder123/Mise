import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260926190000_mise_005y_pilot_control_action_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalPilot = readFileSync(
  new URL(
    "../supabase/migrations/20260824230000_mise_pilot_001_atomic_controls.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/pilot_control_action_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

function pilotControlDeclare(source: string): string {
  const fnStart = source.indexOf(
    "create or replace function public.service_apply_pilot_operational_control("
  );
  assert.ok(fnStart >= 0, "service_apply_pilot_operational_control must exist");
  const begin = source.indexOf("begin", fnStart);
  assert.ok(begin > fnStart, "function body begin must follow declare");
  return source.slice(fnStart, begin);
}

function pilotControlReasonGate(source: string): string {
  const fnStart = source.indexOf(
    "create or replace function public.service_apply_pilot_operational_control("
  );
  assert.ok(fnStart >= 0, "service_apply_pilot_operational_control must exist");
  const reasonGate = source.indexOf("normalized_reason", fnStart);
  assert.ok(reasonGate > fnStart, "normalized_reason gate must exist");
  const end = source.indexOf("Pilot control reason code is not supported.", reasonGate);
  assert.ok(end > reasonGate, "reason rejection message must follow gate");
  return source.slice(reasonGate, end);
}

test("MISE-005Y pins pilot control action/reason lower to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005Y"), "additive pin must stay labeled");
  assert.match(
    migration,
    /create or replace function public\.service_apply_pilot_operational_control\(\s*p_request_id uuid,\s*p_restaurant_id uuid,\s*p_action text,\s*p_actor_user_id uuid,\s*p_reason_code text/i
  );

  const declareBlock = pilotControlDeclare(migration);
  assert.match(
    declareBlock,
    /normalized_action text := pg_catalog\.lower\(\s*pg_catalog\.btrim\(coalesce\(p_action, ''\)\) collate "C"\s*\) collate "C"/
  );
  assert.match(
    declareBlock,
    /normalized_reason text := pg_catalog\.lower\(\s*pg_catalog\.btrim\(coalesce\(p_reason_code, ''\)\) collate "C"\s*\) collate "C"/
  );
  assert.doesNotMatch(
    declareBlock,
    /normalized_action text := lower\(btrim\(coalesce\(p_action, ''\)\)\);/
  );
  assert.doesNotMatch(
    declareBlock,
    /normalized_reason text := lower\(btrim\(coalesce\(p_reason_code, ''\)\)\);/
  );

  const reasonGate = pilotControlReasonGate(migration);
  assert.match(
    reasonGate,
    /normalized_reason collate "C" !~ '\^\[a-z0-9_\]\{3,64\}\$'/
  );

  assert.match(
    migration,
    /revoke all on function public\.service_apply_pilot_operational_control\(\s*uuid, uuid, text, uuid, text\s*\)\s*from public, anon, authenticated/i
  );
  assert.match(
    migration,
    /grant execute on function public\.service_apply_pilot_operational_control\(\s*uuid, uuid, text, uuid, text\s*\)\s*to service_role/i
  );

  // Compose: do not rewrite sibling mode mutator or state builder.
  assert.doesNotMatch(
    migration,
    /create or replace function public\.service_set_system_operational_mode/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.build_pilot_operational_control_state/i
  );
});

test("MISE-PILOT-001 originally left action/reason on bare lower/btrim", () => {
  const declareBlock = pilotControlDeclare(originalPilot);
  assert.match(
    declareBlock,
    /normalized_action text := lower\(btrim\(coalesce\(p_action, ''\)\)\);/
  );
  assert.match(
    declareBlock,
    /normalized_reason text := lower\(btrim\(coalesce\(p_reason_code, ''\)\)\);/
  );
  assert.doesNotMatch(
    declareBlock,
    /btrim\(coalesce\(p_action, ''\)\) collate "C"/
  );
  assert.doesNotMatch(
    declareBlock,
    /btrim\(coalesce\(p_reason_code, ''\)\) collate "C"/
  );

  const reasonGate = pilotControlReasonGate(originalPilot);
  assert.match(reasonGate, /normalized_reason !~ '\^\[a-z0-9_\]\{3,64\}\$'/);
  assert.doesNotMatch(reasonGate, /normalized_reason collate "C"/);
});

test("pgTAP fixture pins pilot control action/reason to COLLATE C", () => {
  assert.match(pgTap, /select plan\(6\)/);
  assert.match(
    pgTap,
    /pilot control action lower\/btrim uses COLLATE C/
  );
  assert.match(
    pgTap,
    /pilot control reason lower\/btrim uses COLLATE C/
  );
  assert.match(
    pgTap,
    /pilot control reason shape check uses COLLATE C/
  );
  assert.match(
    pgTap,
    /service_role retains EXECUTE on service_apply_pilot_operational_control/
  );
  assert.match(
    pgTap,
    /authenticated lacks EXECUTE on service_apply_pilot_operational_control/
  );
});
