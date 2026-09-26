import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260926200000_mise_005z_operational_mode_reason_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalMode = readFileSync(
  new URL(
    "../supabase/migrations/20260727223000_enforce_emergency_operational_mode.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/operational_mode_reason_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

function operationalModeReasonGate(source: string): string {
  const fnStart = source.indexOf(
    "create or replace function public.service_set_system_operational_mode("
  );
  assert.ok(fnStart >= 0, "service_set_system_operational_mode must exist");
  const reasonGate = source.indexOf("p_reason_code is null", fnStart);
  assert.ok(reasonGate > fnStart, "reason_code null/shape gate must exist");
  const end = source.indexOf("Reason code is not supported.", reasonGate);
  assert.ok(end > reasonGate, "reason rejection message must follow gate");
  return source.slice(reasonGate, end);
}

test("MISE-005Z pins operational mode reason shape to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005Z"), "additive pin must stay labeled");
  assert.match(
    migration,
    /create or replace function public\.service_set_system_operational_mode\(\s*p_request_id uuid,\s*p_next_mode text,\s*p_reason_code text,\s*p_actor_user_id uuid default null/i
  );

  const reasonGate = operationalModeReasonGate(migration);
  assert.match(
    reasonGate,
    /p_reason_code collate "C" !~ '\^\[a-z0-9_\]\{3,64\}\$'/
  );
  assert.doesNotMatch(
    reasonGate,
    /p_reason_code is null or p_reason_code !~ '\^\[a-z0-9_\]\{3,64\}\$'/
  );

  assert.match(
    migration,
    /revoke all on function public\.service_set_system_operational_mode\(\s*uuid, text, text, uuid\s*\)\s*from public, anon, authenticated/i
  );
  assert.match(
    migration,
    /grant execute on function public\.service_set_system_operational_mode\(\s*uuid, text, text, uuid\s*\)\s*to service_role/i
  );

  // Compose: do not rewrite sibling pilot control mutator.
  assert.doesNotMatch(
    migration,
    /create or replace function public\.service_apply_pilot_operational_control/i
  );
});

test("enforce_emergency_operational_mode originally left reason shape bare", () => {
  const reasonGate = operationalModeReasonGate(originalMode);
  assert.match(
    reasonGate,
    /p_reason_code is null or p_reason_code !~ '\^\[a-z0-9_\]\{3,64\}\$'/
  );
  assert.doesNotMatch(reasonGate, /p_reason_code collate "C"/);
});

test("pgTAP fixture pins operational mode reason shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(5\)/);
  assert.match(
    pgTap,
    /operational mode reason shape check uses COLLATE C/
  );
  assert.match(
    pgTap,
    /operational mode reason shape check is no longer bare/
  );
  assert.match(
    pgTap,
    /service_role retains EXECUTE on service_set_system_operational_mode/
  );
  assert.match(
    pgTap,
    /authenticated lacks EXECUTE on service_set_system_operational_mode/
  );
});
