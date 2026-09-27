import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927000200_mise_005ae_gmail_safe_error_code_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalGmail = readFileSync(
  new URL(
    "../supabase/migrations/20260719062148_gmail_backend_oauth_delivery.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/gmail_safe_error_code_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

function gmailSafeErrorCodeBody(source: string): string {
  const fnStart = source.indexOf(
    "create or replace function private.gmail_safe_error_code(p_error_code text)"
  );
  assert.ok(fnStart >= 0, "private.gmail_safe_error_code must exist");
  const end = source.indexOf("$$;", fnStart);
  assert.ok(end > fnStart, "function body terminator must follow definition");
  return source.slice(fnStart, end);
}

test("MISE-005AE pins gmail_safe_error_code shape to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AE"), "additive pin must stay labeled");
  assert.match(
    migration,
    /create or replace function private\.gmail_safe_error_code\(p_error_code text\)/i
  );

  const body = gmailSafeErrorCodeBody(migration);
  assert.match(
    body,
    /p_error_code collate "C" !~ '\^\[a-z0-9_\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    body,
    /p_error_code is null or p_error_code !~ '\^\[a-z0-9_\]\{1,80\}\$'/
  );

  assert.match(
    migration,
    /revoke all on function private\.gmail_safe_error_code\(text\)\s*from public, anon, authenticated, service_role/i
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function private\.gmail_safe_error_code/i
  );

  // Compose: do not rewrite the separate mise_actions failure path or
  // finding-decision policy_version in this tip (comments may name them).
  const sqlBody = migration.replace(/^--.*$/gm, "");
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.service_record_mise_action_failure/i
  );
  assert.doesNotMatch(sqlBody, /operational_finding_decisions/i);
  assert.doesNotMatch(sqlBody, /append_operational_finding_decision/i);
});

test("gmail_backend_oauth_delivery originally left error-code shape bare", () => {
  const body = gmailSafeErrorCodeBody(originalGmail);
  assert.match(
    body,
    /p_error_code is null or p_error_code !~ '\^\[a-z0-9_\]\{1,80\}\$'/
  );
  assert.doesNotMatch(body, /p_error_code collate "C"/);
});

test("pgTAP fixture pins gmail_safe_error_code shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(5\)/);
  assert.match(pgTap, /gmail_safe_error_code shape check uses COLLATE C/);
  assert.match(pgTap, /gmail_safe_error_code shape check is no longer bare/);
  assert.match(
    pgTap,
    /service_role lacks EXECUTE on internal gmail_safe_error_code/
  );
  assert.match(
    pgTap,
    /authenticated lacks EXECUTE on internal gmail_safe_error_code/
  );
});
