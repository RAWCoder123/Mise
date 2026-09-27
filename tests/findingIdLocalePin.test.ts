import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927000500_mise_005ah_finding_id_locale_pin.sql",
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
    "../supabase/tests/database/finding_id_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

function findingIdGate(source: string): string {
  const fnStart = source.indexOf(
    "create or replace function public.record_operational_finding_decision("
  );
  assert.ok(fnStart >= 0, "record_operational_finding_decision must exist");
  const gateStart = source.indexOf("p_finding_id is null", fnStart);
  assert.ok(gateStart > fnStart, "finding_id null/shape gate must exist");
  const end = source.indexOf(
    "Operational finding decision evidence is invalid.",
    gateStart
  );
  assert.ok(end > gateStart, "invalid evidence message must follow gate");
  return source.slice(gateStart, end);
}

test("MISE-005AH pins finding_id shape to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AH"), "additive pin must stay labeled");
  assert.match(
    migration,
    /add constraint operational_finding_decisions_finding_id_shape_check/i
  );
  assert.match(
    migration,
    /finding_id collate "C" ~ '\^finding:\[a-z0-9\]\[a-z0-9:_-\]\{1,231\}\$'/
  );
  assert.match(
    migration,
    /create or replace function public\.record_operational_finding_decision\(/i
  );

  const gate = findingIdGate(migration);
  assert.match(
    gate,
    /trim\(p_finding_id\) collate "C" !~ '\^finding:\[a-z0-9\]\[a-z0-9:_-\]\{1,231\}\$'/
  );
  assert.doesNotMatch(
    gate,
    /trim\(p_finding_id\) !~ '\^finding:\[a-z0-9\]\[a-z0-9:_-\]\{1,231\}\$'/
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
  // policy_version shape remains bare in this tip (owned by open #440).
  assert.match(
    sqlBody,
    /trim\(p_policy_version\) !~ '\^\[a-z0-9\]\[a-z0-9\._-\]\{2,63\}\$'/
  );
  assert.doesNotMatch(sqlBody, /trim\(p_policy_version\) collate "C"/);
  assert.doesNotMatch(
    sqlBody,
    /policy_version collate "C" ~ '\^\[a-z0-9\]\[a-z0-9\._-\]\{2,63\}\$'/
  );
});

test("append_operational_finding_decisions originally left finding_id bare", () => {
  assert.match(
    originalFinding,
    /finding_id text not null check \(length\(trim\(finding_id\)\) between 8 and 240\)/
  );
  assert.doesNotMatch(
    originalFinding,
    /finding_id collate "C" ~ '\^finding:\[a-z0-9\]\[a-z0-9:_-\]\{1,231\}\$'/
  );

  const gate = findingIdGate(originalFinding);
  assert.match(
    gate,
    /trim\(p_finding_id\) !~ '\^finding:\[a-z0-9\]\[a-z0-9:_-\]\{1,231\}\$'/
  );
  assert.doesNotMatch(gate, /trim\(p_finding_id\) collate "C"/);
});

test("pgTAP fixture pins finding_id shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(6\)/);
  assert.match(pgTap, /finding_id shape CHECK uses COLLATE C/);
  assert.match(
    pgTap,
    /exactly one finding_id shape CHECK remains on operational_finding_decisions/
  );
  assert.match(
    pgTap,
    /record_operational_finding_decision finding_id gate uses COLLATE C/
  );
  assert.match(
    pgTap,
    /record_operational_finding_decision finding_id gate is no longer bare/
  );
  assert.match(
    pgTap,
    /authenticated retains EXECUTE on record_operational_finding_decision/
  );
});
