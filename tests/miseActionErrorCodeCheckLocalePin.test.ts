import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927120000_mise_005ao_mise_action_error_code_check_locale_pin.sql",
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
    "../supabase/tests/database/mise_action_error_code_check_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const ERROR_PATTERN = "^[a-z0-9_]{1,80}$";

test("MISE-005AO pins mise_actions.error_code CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AO"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint mise_actions_error_code_check check \(\s*error_code is null\s*or error_code collate "C" ~ '\^\[a-z0-9_\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`error_code collate "C" ~ '${ERROR_PATTERN}'`),
    "CHECK must pin error_code under COLLATE C"
  );
  assert.ok(
    migration.includes("error_code is null"),
    "CHECK must keep null success rows legal"
  );

  // Compose: CHECK-only. Do not rewrite writers owned by open stacks.
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.service_record_mise_action_failure/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.gmail_safe_error_code/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function public\.record_operational_finding_decision/i
  );
  assert.doesNotMatch(
    sqlBody,
    /operational_mode_changes_reason_code_check/i
  );
  assert.doesNotMatch(
    sqlBody,
    /pilot_operational_control_changes_reason_code_check/i
  );
});

test("original mise_actions.error_code had no shape CHECK", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.mise_actions[\s\S]*?\berror_code text,/
  );
  assert.doesNotMatch(
    originalFoundation,
    /mise_actions_error_code_check|error_code collate "C" ~ '\^\[a-z0-9_\]\{1,80\}\$'/
  );
  assert.match(
    originalFoundation,
    /p_error_code !~ '\^\[a-z0-9_\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    originalFoundation,
    /p_error_code collate "C" !~ '\^\[a-z0-9_\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins mise_actions.error_code CHECK to COLLATE C", () => {
  assert.match(pgTap, /select plan\(8\)/);
  assert.match(pgTap, /mise_actions_error_code_check exists/);
  assert.match(pgTap, /mise_actions\.error_code CHECK uses COLLATE C/);
  assert.match(pgTap, /mise_actions\.error_code CHECK allows null success rows/);
  assert.match(pgTap, /ASCII snake_case error_code matches under COLLATE C/);
  assert.match(pgTap, /uppercase error_code is rejected under COLLATE C/);
  assert.match(pgTap, /empty error_code is rejected under COLLATE C/);
  assert.match(pgTap, /hyphenated error_code is rejected under COLLATE C/);
  assert.match(pgTap, /mise_actions has no bare error_code class CHECK/);
});
