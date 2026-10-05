import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261005210000_mise_005ig_supplier_email_deliveries_last_error_code_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/supplier_email_deliveries_last_error_code_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005IG pins supplier_email_deliveries.last_error_code CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005IG"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint supplier_email_deliveries_last_error_code_check check \(\s*last_error_code is null\s*or \(\s*length\(last_error_code\) between 1 and 80\s*and last_error_code collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`last_error_code collate "C" !~ '[[:cntrl:]]'`),
    "last_error_code CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(last_error_code) between 1 and 80"),
    "exact length bound must match foundation CHECK"
  );

  // Compose: CHECK-only. Do not rewrite Gmail writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create trigger/i);
  assert.doesNotMatch(sqlBody, /gmail_safe_error_code/);
  assert.doesNotMatch(sqlBody, /service_complete_supplier_email/);
  assert.doesNotMatch(sqlBody, /service_claim_supplier_email/);
  assert.doesNotMatch(
    sqlBody,
    /add constraint supplier_email_deliveries_status_check/
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint supplier_email_deliveries_provider_message_id_check/
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint supplier_email_deliveries_rfc_message_id_check/
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint supplier_email_deliveries_sent_check/
  );
  assert.doesNotMatch(sqlBody, /mise_003c_metadata/);
  assert.doesNotMatch(sqlBody, /mise_003b_metadata/);
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
    /not ilike '%status%'/,
    "must leave status vocabulary untouched"
  );
  assert.match(
    migration,
    /not ilike '%provider_message_id%'/,
    "must leave provider_message_id bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%rfc_message_id%'/,
    "must leave rfc_message_id bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%provider_accepted_at%'/,
    "must leave sent_check composition untouched"
  );
});

test("original supplier_email_deliveries.last_error_code was length-only; writers use gmail_safe_error_code", () => {
  assert.match(
    original,
    /last_error_code text check \(last_error_code is null or length\(last_error_code\) between 1 and 80\)/
  );
  assert.doesNotMatch(
    original,
    /last_error_code text check \([^)]*\[\[:cntrl:\]\]/
  );
  assert.match(
    original,
    /p_error_code is null or p_error_code !~ '\^\[a-z0-9_\]\{1,80\}\$'/
  );
  assert.match(original, /private\.gmail_safe_error_code\(p_error_code\)/);
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

  assert.match(pgTap, /last_error_code collate "C" !~/);
  assert.match(pgTap, /\[\[:cntrl:\]\]/);
  assert.match(pgTap, /tab in delivery last_error_code is rejected/);
  assert.match(pgTap, /newline in delivery last_error_code is rejected/);
  assert.match(pgTap, /NUL in delivery last_error_code is rejected/);
  assert.match(pgTap, /private\.supplier_email_deliveries/);
});
