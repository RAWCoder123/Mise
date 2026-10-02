import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001480000_mise_005fr_sales_imports_error_message_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/202606210002_restaurant_ops_backbone.sql",
    import.meta.url
  ),
  "utf8"
);
const squareSync = readFileSync(
  new URL(
    "../supabase/migrations/20260730210000_square_backend_oauth_sync.sql",
    import.meta.url
  ),
  "utf8"
);
const authorityCorrection = readFileSync(
  new URL(
    "../supabase/migrations/20260822063410_mise_003a_authority_correction.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/sales_imports_error_message_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005FR pins sales_imports.error_message CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005FR"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint sales_imports_error_message_check check \(\s*error_message is null\s*or \(\s*length\(trim\(error_message\)\) between 1 and 200\s*and error_message collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`error_message collate "C" !~ '[[:cntrl:]]'`),
    "sales_imports error_message CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(error_message)) between 1 and 200"),
    "exact length(trim) bound must match left(safe_code, 200) writer"
  );
  assert.ok(migration.includes("error_message is null"), "nullability must be preserved");

  // Compose: CHECK-only. Do not rewrite Square sync writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /service_record_square_sync_failure/i);
  assert.doesNotMatch(sqlBody, /service_apply_square_sync_result/i);
  assert.doesNotMatch(sqlBody, /import_manual_pos_sales/i);
  assert.doesNotMatch(sqlBody, /gmail_safe_error_code/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.mise_actions/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_integrations/i);
  assert.doesNotMatch(
    sqlBody,
    /sales_imports_source_file_name_check/,
    "must not attach or rewrite the source_file_name sibling CHECK"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint[^;]*source_file_name/i,
    "must not add a source_file_name constraint"
  );
  assert.doesNotMatch(
    sqlBody,
    /\^[a-z0-9_]/,
    "must not expand to charset allowlist; cntrl-only tip"
  );
  assert.match(
    migration,
    /not ilike '%source_file_name%'/,
    "must leave source_file_name bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%import_type%'/,
    "must leave import_type bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%status%'/,
    "must leave status bounds untouched"
  );
  assert.match(
    migration,
    /left\(safe_code, 200\)/,
    "migration rationale must document the left(safe_code, 200) writer shape"
  );
});

test("original sales_imports.error_message had no CHECK; failure writers truncate to 200", () => {
  assert.match(
    original,
    /create table if not exists public\.sales_imports \([\s\S]*?error_message text,/
  );
  assert.doesNotMatch(
    original,
    /create table if not exists public\.sales_imports \([\s\S]*?error_message text[^\n]*check/
  );
  assert.doesNotMatch(original, /sales_imports_error_message_check/);

  assert.match(
    squareSync,
    /safe_code text := private\.gmail_safe_error_code\(p_error_code\);[\s\S]*?insert into public\.sales_imports \([\s\S]*?error_message[\s\S]*?left\(safe_code, 200\)/
  );
  assert.match(
    authorityCorrection,
    /safe_code text := private\.gmail_safe_error_code\(p_error_code\);[\s\S]*?insert into public\.sales_imports \([\s\S]*?error_message[\s\S]*?left\(safe_code, 200\)/
  );
});

test("nullable length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedErrorMessage = (value: string | null) =>
    value === null ||
    (value.trim().length >= 1 &&
      value.trim().length <= 200 &&
      !/[\u0000-\u001f\u007f]/.test(value));

  assert.equal(isAllowedErrorMessage(null), true);
  assert.equal(isAllowedErrorMessage("square_sync_rate_limited"), true);
  assert.equal(isAllowedErrorMessage("a".repeat(200)), true);
  assert.equal(isAllowedErrorMessage("a".repeat(201)), false);
  assert.equal(isAllowedErrorMessage(""), false);
  assert.equal(isAllowedErrorMessage("   "), false);
  assert.equal(isAllowedErrorMessage("square\tsync_failed"), false);
  assert.equal(isAllowedErrorMessage("square\nsync_failed"), false);
  assert.equal(isAllowedErrorMessage("square\u007fsync_failed"), false);
});

test("pgTAP plan is derived from assertion call sites, not from a passing run", () => {
  const planMatch = pgTap.match(/select plan\((\d+)\);/);
  assert.ok(planMatch, "pgTAP file must declare an explicit plan");
  const planned = Number(planMatch[1]);

  const assertionCalls = [
    ...pgTap.matchAll(
      /^\s*select\s+(ok|is|matches|throws_ok|lives_ok|isnt|alike|throws_like)\s*\(/gim
    )
  ];
  assert.equal(
    planned,
    assertionCalls.length,
    `plan(${planned}) must equal ${assertionCalls.length} assertion call sites counted from source`
  );

  assert.match(pgTap, /error_message collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(error_message\\\)\\\) between 1 and 200/
  );
  assert.match(pgTap, /tab in sales_imports error_message is rejected/);
  assert.match(pgTap, /DEL in sales_imports error_message is rejected/);
});
