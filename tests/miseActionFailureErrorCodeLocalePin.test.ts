import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927000400_mise_005ag_mise_action_failure_error_code_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalFoundation = readFileSync(
  new URL(
    "../supabase/migrations/20260802204120_operational_backend_foundation.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/mise_action_failure_error_code_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

function privateFailureBody(source: string): string {
  const fnStart = source.indexOf(
    "create or replace function private.service_record_mise_action_failure("
  );
  assert.ok(fnStart >= 0, "private.service_record_mise_action_failure must exist");
  const end = source.indexOf("$$;", fnStart);
  assert.ok(end > fnStart, "function body terminator must follow definition");
  return source.slice(fnStart, end);
}

test("MISE-005AG pins mise_action failure error_code shape to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AG"), "additive pin must stay labeled");
  assert.match(
    migration,
    /create or replace function private\.service_record_mise_action_failure\(/i
  );

  const body = privateFailureBody(migration);
  assert.match(
    body,
    /p_error_code collate "C" !~ '\^\[a-z0-9_\]\{1,80\}\$'/
  );
  assert.doesNotMatch(body, /p_error_code !~ '\^\[a-z0-9_\]\{1,80\}\$'/);

  assert.match(
    migration,
    /revoke all on function private\.service_record_mise_action_failure\([\s\S]*?\) from public, anon, authenticated, service_role/i
  );
  assert.match(
    migration,
    /revoke all on function public\.service_record_mise_action_failure\([\s\S]*?\) from public, anon, authenticated, service_role/i
  );
  assert.match(
    migration,
    /grant execute on function private\.service_record_mise_action_failure\([\s\S]*?\) to service_role/i
  );
  assert.match(
    migration,
    /grant execute on function public\.service_record_mise_action_failure\([\s\S]*?\) to service_role/i
  );

  // Compose: do not rewrite the shared Gmail/Square helper or finding_id in
  // this tip (comments may name them).
  const sqlBody = migration.replace(/^--.*$/gm, "");
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.gmail_safe_error_code/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function public\.service_record_mise_action_failure/i
  );
  assert.doesNotMatch(sqlBody, /operational_finding_decisions/i);
  assert.doesNotMatch(sqlBody, /record_operational_finding_decision/i);
});

test("operational_backend_foundation originally left failure error_code shape bare", () => {
  const body = privateFailureBody(originalFoundation);
  assert.match(body, /p_error_code !~ '\^\[a-z0-9_\]\{1,80\}\$'/);
  assert.doesNotMatch(body, /p_error_code collate "C"/);
});

test("pgTAP fixture pins mise_action failure error_code shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(6\)/);
  assert.match(pgTap, /mise_action failure error_code shape check uses COLLATE C/);
  assert.match(
    pgTap,
    /mise_action failure error_code shape check is no longer bare/
  );
  assert.match(
    pgTap,
    /authenticated lacks EXECUTE on public service_record_mise_action_failure/
  );
  assert.match(
    pgTap,
    /service_role retains EXECUTE on public service_record_mise_action_failure/
  );
  assert.match(
    pgTap,
    /service_role retains EXECUTE on private service_record_mise_action_failure/
  );
});
