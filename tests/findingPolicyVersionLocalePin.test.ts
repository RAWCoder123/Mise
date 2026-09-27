import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927000300_mise_005af_finding_policy_version_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalFinding = readFileSync(
  new URL(
    "../supabase/migrations/20260728192830_append_operational_finding_decisions.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/finding_policy_version_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

function policyVersionGate(source: string): string {
  const fnStart = source.indexOf(
    "create or replace function public.record_operational_finding_decision("
  );
  assert.ok(fnStart >= 0, "record_operational_finding_decision must exist");
  const gateStart = source.indexOf("p_policy_version is null", fnStart);
  assert.ok(gateStart > fnStart, "policy_version null/shape gate must exist");
  const end = source.indexOf(
    "Operational finding decision evidence is invalid.",
    gateStart
  );
  assert.ok(end > gateStart, "invalid evidence message must follow gate");
  return source.slice(gateStart, end);
}

test("MISE-005AF pins finding policy_version shape to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AF"), "additive pin must stay labeled");
  assert.match(
    migration,
    /add constraint operational_finding_decisions_policy_version_check/i
  );
  assert.match(
    migration,
    /policy_version collate "C" ~ '\^\[a-z0-9\]\[a-z0-9\._-\]\{2,63\}\$'/
  );
  assert.match(
    migration,
    /create or replace function public\.record_operational_finding_decision\(/i
  );

  const gate = policyVersionGate(migration);
  assert.match(
    gate,
    /trim\(p_policy_version\) collate "C" !~ '\^\[a-z0-9\]\[a-z0-9\._-\]\{2,63\}\$'/
  );
  assert.doesNotMatch(
    gate,
    /trim\(p_policy_version\) !~ '\^\[a-z0-9\]\[a-z0-9\._-\]\{2,63\}\$'/
  );

  assert.match(
    migration,
    /revoke all on function public\.record_operational_finding_decision\([\s\S]*?\) from public, anon, authenticated/i
  );
  assert.match(
    migration,
    /grant execute on function public\.record_operational_finding_decision\([\s\S]*?\) to authenticated/i
  );

  // Intentionally deferred siblings stay out of this tip's SQL body.
  const sqlBody = migration.replace(/^--.*$/gm, "");
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.service_record_mise_action_failure/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.gmail_safe_error_code/i
  );
  // finding_id shape remains bare in this tip (same class risk; separate tip).
  assert.match(
    sqlBody,
    /trim\(p_finding_id\) !~ '\^finding:\[a-z0-9\]\[a-z0-9:_-\]\{1,231\}\$'/
  );
  assert.doesNotMatch(sqlBody, /trim\(p_finding_id\) collate "C"/);
});

test("append_operational_finding_decisions originally left policy_version bare", () => {
  assert.match(
    originalFinding,
    /check \(policy_version ~ '\^\[a-z0-9\]\[a-z0-9\._-\]\{2,63\}\$'\)/
  );
  assert.doesNotMatch(
    originalFinding,
    /policy_version collate "C" ~ '\^\[a-z0-9\]\[a-z0-9\._-\]\{2,63\}\$'/
  );

  const gate = policyVersionGate(originalFinding);
  assert.match(
    gate,
    /trim\(p_policy_version\) !~ '\^\[a-z0-9\]\[a-z0-9\._-\]\{2,63\}\$'/
  );
  assert.doesNotMatch(gate, /trim\(p_policy_version\) collate "C"/);
});

test("pgTAP fixture pins finding policy_version shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(6\)/);
  assert.match(pgTap, /finding policy_version CHECK uses COLLATE C/);
  assert.match(
    pgTap,
    /exactly one policy_version CHECK remains on operational_finding_decisions/
  );
  assert.match(
    pgTap,
    /record_operational_finding_decision policy_version gate uses COLLATE C/
  );
  assert.match(
    pgTap,
    /record_operational_finding_decision policy_version gate is no longer bare/
  );
  assert.match(
    pgTap,
    /authenticated retains EXECUTE on record_operational_finding_decision/
  );
});
