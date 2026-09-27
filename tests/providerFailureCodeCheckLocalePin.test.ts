import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927130000_mise_005ap_provider_failure_code_check_locale_pin.sql",
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
const originalSquare = readFileSync(
  new URL(
    "../supabase/migrations/20260730210000_square_backend_oauth_sync.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/provider_failure_code_check_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const ERROR_PATTERN = "^[a-z0-9_]{1,80}$";

test("MISE-005AP pins provider failure_code CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AP"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint gmail_oauth_flows_failure_code_check check \(\s*failure_code is null\s*or failure_code collate "C" ~ '\^\[a-z0-9_\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint square_oauth_flows_failure_code_check check \(\s*failure_code is null\s*or failure_code collate "C" ~ '\^\[a-z0-9_\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint supplier_email_deliveries_last_error_code_check check \(\s*last_error_code is null\s*or last_error_code collate "C" ~ '\^\[a-z0-9_\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`failure_code collate "C" ~ '${ERROR_PATTERN}'`),
    "OAuth failure_code CHECKs must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`last_error_code collate "C" ~ '${ERROR_PATTERN}'`),
    "delivery last_error_code CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("failure_code is null"),
    "OAuth CHECKs must keep null success rows legal"
  );
  assert.ok(
    migration.includes("last_error_code is null"),
    "delivery CHECK must keep null success rows legal"
  );

  // Compose: CHECK-only. Do not rewrite writers or sibling pins.
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.gmail_safe_error_code/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.service_record_mise_action_failure/i
  );
  assert.doesNotMatch(sqlBody, /gmail_oauth_flows_state_hash_check/i);
  assert.doesNotMatch(sqlBody, /square_oauth_flows_state_hash_check/i);
  assert.doesNotMatch(
    sqlBody,
    /supplier_email_deliveries_content_fingerprint_hex_check/i
  );
  assert.doesNotMatch(
    sqlBody,
    /supplier_email_deliveries_authority_fingerprint_hex_check/i
  );
  assert.doesNotMatch(sqlBody, /mise_actions_error_code_check/i);
  assert.doesNotMatch(
    sqlBody,
    /supplier_email_deliveries_provider_message_id/i
  );
});

test("original provider failure columns were length-only", () => {
  assert.match(
    originalGmail,
    /failure_code text check \(failure_code is null or length\(failure_code\) between 1 and 80\)/
  );
  assert.match(
    originalGmail,
    /last_error_code text check \(last_error_code is null or length\(last_error_code\) between 1 and 80\)/
  );
  assert.doesNotMatch(
    originalGmail,
    /failure_code collate "C" ~ '\^\[a-z0-9_\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    originalGmail,
    /last_error_code collate "C" ~ '\^\[a-z0-9_\]\{1,80\}\$'/
  );
  assert.match(
    originalGmail,
    /p_error_code !~ '\^\[a-z0-9_\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    originalGmail,
    /p_error_code collate "C" !~ '\^\[a-z0-9_\]\{1,80\}\$'/
  );

  assert.match(
    originalSquare,
    /failure_code text check \(failure_code is null or length\(failure_code\) between 1 and 80\)/
  );
  assert.doesNotMatch(
    originalSquare,
    /failure_code collate "C" ~ '\^\[a-z0-9_\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins provider failure_code CHECKs to COLLATE C", () => {
  assert.match(pgTap, /select plan\(16\)/);
  assert.match(pgTap, /gmail_oauth_flows_failure_code_check exists/);
  assert.match(pgTap, /gmail_oauth_flows\.failure_code CHECK uses COLLATE C/);
  assert.match(
    pgTap,
    /gmail_oauth_flows\.failure_code CHECK allows null success rows/
  );
  assert.match(pgTap, /square_oauth_flows_failure_code_check exists/);
  assert.match(pgTap, /square_oauth_flows\.failure_code CHECK uses COLLATE C/);
  assert.match(
    pgTap,
    /square_oauth_flows\.failure_code CHECK allows null success rows/
  );
  assert.match(
    pgTap,
    /supplier_email_deliveries_last_error_code_check exists/
  );
  assert.match(
    pgTap,
    /supplier_email_deliveries\.last_error_code CHECK uses COLLATE C/
  );
  assert.match(
    pgTap,
    /supplier_email_deliveries\.last_error_code CHECK allows null success rows/
  );
  assert.match(
    pgTap,
    /ASCII snake_case provider failure code matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /uppercase provider failure code is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /empty provider failure code is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /hyphenated provider failure code is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /gmail_oauth_flows has no length-only or bare failure_code CHECK/
  );
  assert.match(
    pgTap,
    /square_oauth_flows has no length-only or bare failure_code CHECK/
  );
  assert.match(
    pgTap,
    /supplier_email_deliveries has no length-only or bare last_error_code CHECK/
  );
});
