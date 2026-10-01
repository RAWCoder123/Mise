import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001010000_mise_005dw_purchase_recommendations_urgency_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/202606210001_secure_multi_tenant_rls.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/purchase_recommendations_urgency_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DW pins purchase_recommendations urgency CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DW"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint purchase_recommendations_urgency_check\s+check \(\s*urgency in \(\s*'low',\s*'medium',\s*'high'\s*\)\s*and urgency collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`urgency collate "C" ~ '${TOKEN_PATTERN}'`),
    "urgency CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'low'") &&
      migration.includes("'medium'") &&
      migration.includes("'high'"),
    "exact urgency allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /purchase_recommendations_generation_source_check/i);
  assert.doesNotMatch(sqlBody, /purchase_recommendations_planning_revision_check/i);
  assert.doesNotMatch(sqlBody, /purchase_recommendations_status_check/i);
  assert.doesNotMatch(sqlBody, /\bstatus\b/);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_orders/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_decision_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.supplier_orders/i);
  assert.doesNotMatch(sqlBody, /approve_purchase_recommendation/i);
  assert.doesNotMatch(sqlBody, /dismiss_purchase_recommendation/i);
  assert.doesNotMatch(sqlBody, /replace_pending_purchase_recommendations/i);
});

test("original purchase_recommendations urgency used bare IN without COLLATE C shape", () => {
  assert.match(
    original,
    /urgency text not null check \(urgency in \('low', 'medium', 'high'\)\)/
  );
  assert.doesNotMatch(
    original,
    /urgency collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins purchase_recommendations urgency to COLLATE C", () => {
  assert.match(pgTap, /select plan\(11\)/);
  assert.match(pgTap, /purchase_recommendations_urgency_check exists/);
  assert.match(pgTap, /purchase_recommendations urgency CHECK keeps exact allowlist/);
  assert.match(pgTap, /purchase_recommendations urgency CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token low matches under COLLATE C/);
  assert.match(pgTap, /writer token medium matches under COLLATE C/);
  assert.match(pgTap, /writer token high matches under COLLATE C/);
  assert.match(pgTap, /spaced urgency token is rejected under COLLATE C/);
  assert.match(pgTap, /empty urgency token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated urgency token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII urgency token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted urgency tokens match under COLLATE C/);
});
