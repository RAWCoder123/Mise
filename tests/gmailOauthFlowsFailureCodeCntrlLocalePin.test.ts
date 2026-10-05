import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261005220000_mise_005ih_gmail_oauth_flows_failure_code_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260719062148_gmail_backend_oauth_delivery.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/gmail_oauth_flows_failure_code_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005IH pins gmail_oauth_flows.failure_code CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005IH"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint gmail_oauth_flows_failure_code_check check \(\s*failure_code is null\s*or \(\s*length\(failure_code\) between 1 and 80\s*and failure_code collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`failure_code collate "C" !~ '[[:cntrl:]]'`),
    "failure_code CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(failure_code) between 1 and 80"),
    "exact length bound must match foundation CHECK"
  );

  // Compose: CHECK-only. Do not rewrite Gmail writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create trigger/i);
  assert.doesNotMatch(sqlBody, /gmail_safe_error_code/);
  assert.doesNotMatch(sqlBody, /service_fail_gmail/);
  assert.doesNotMatch(sqlBody, /service_complete_gmail/);
  assert.doesNotMatch(sqlBody, /service_claim_gmail/);
  assert.doesNotMatch(sqlBody, /square_oauth_flows/);
  assert.doesNotMatch(sqlBody, /supplier_email_deliveries/);
  assert.doesNotMatch(sqlBody, /activity_events/);
  assert.doesNotMatch(sqlBody, /outreach_/);
  assert.doesNotMatch(sqlBody, /recalculation_runs/);
  assert.doesNotMatch(
    sqlBody,
    /\^[a-z0-9_]/,
    "must not expand to charset allowlist; cntrl-only tip"
  );
  assert.match(
    migration,
    /not ilike '%state_hash%'/,
    "must leave state_hash vocabulary untouched"
  );
  assert.match(
    migration,
    /not ilike '%expires_at%'/,
    "must leave expiry CHECK composition untouched"
  );
  assert.match(
    migration,
    /not ilike '%completed_at%'/,
    "must leave terminal CHECK composition untouched"
  );
  assert.match(
    migration,
    /not ilike '%failed_at%'/,
    "must leave terminal CHECK failed_at composition untouched"
  );
});

test("original gmail_oauth_flows.failure_code was length-only; writers use gmail_safe_error_code", () => {
  assert.match(
    original,
    /failure_code text check \(failure_code is null or length\(failure_code\) between 1 and 80\)/
  );
  assert.doesNotMatch(
    original,
    /failure_code text check \([^)]*\[\[:cntrl:\]\]/
  );
  assert.match(original, /private\.gmail_safe_error_code\(p_error_code\)/);
  assert.match(original, /failure_code = 'superseded'/);
  assert.match(original, /failure_code = safe_code/);
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

  assert.match(pgTap, /failure_code collate "C" !~/);
  assert.match(pgTap, /\[\[:cntrl:\]\]/);
  assert.match(pgTap, /tab in oauth failure_code is rejected/);
  assert.match(pgTap, /newline in oauth failure_code is rejected/);
  assert.match(pgTap, /NUL in oauth failure_code is rejected/);
  assert.match(pgTap, /private\.gmail_oauth_flows/);
});
