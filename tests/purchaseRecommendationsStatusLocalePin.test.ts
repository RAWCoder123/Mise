import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930360000_mise_005dv_purchase_recommendations_status_locale_pin.sql",
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
    "../supabase/tests/database/purchase_recommendations_status_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DV pins purchase_recommendations status CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DV"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint purchase_recommendations_status_check\s+check \(\s*status in \(\s*'pending',\s*'approved',\s*'dismissed',\s*'ordered'\s*\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`status collate "C" ~ '${TOKEN_PATTERN}'`),
    "status CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'pending'") &&
      migration.includes("'approved'") &&
      migration.includes("'dismissed'") &&
      migration.includes("'ordered'"),
    "exact status allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /purchase_recommendations_generation_source_check/i);
  assert.doesNotMatch(sqlBody, /purchase_recommendations_planning_revision_check/i);
  assert.doesNotMatch(sqlBody, /urgency/);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_orders/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_decision_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.supplier_orders/i);
  assert.doesNotMatch(sqlBody, /approve_purchase_recommendation/i);
  assert.doesNotMatch(sqlBody, /dismiss_purchase_recommendation/i);
  assert.doesNotMatch(sqlBody, /replace_pending_purchase_recommendations/i);
});

test("original purchase_recommendations status used bare IN without COLLATE C shape", () => {
  assert.match(
    original,
    /status text not null default 'pending' check \(status in \('pending', 'approved', 'dismissed', 'ordered'\)\)/
  );
  assert.doesNotMatch(
    original,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins purchase_recommendations status to COLLATE C", () => {
  assert.match(pgTap, /select plan\(12\)/);
  assert.match(pgTap, /purchase_recommendations_status_check exists/);
  assert.match(pgTap, /purchase_recommendations status CHECK keeps exact allowlist/);
  assert.match(pgTap, /purchase_recommendations status CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token pending matches under COLLATE C/);
  assert.match(pgTap, /writer token approved matches under COLLATE C/);
  assert.match(pgTap, /writer token dismissed matches under COLLATE C/);
  assert.match(pgTap, /writer token ordered matches under COLLATE C/);
  assert.match(pgTap, /spaced status token is rejected under COLLATE C/);
  assert.match(pgTap, /empty status token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated status token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII status token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted status tokens match under COLLATE C/);
});
