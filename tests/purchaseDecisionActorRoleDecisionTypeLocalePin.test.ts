import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001040000_mise_005dz_purchase_decision_actor_role_decision_type_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260824120000_mise_004a_purchase_decision_memory.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/purchase_decision_actor_role_decision_type_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DZ pins purchase_decision actor_role and decision_type CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DZ"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint purchase_decision_events_actor_role_check\s+check \(\s*actor_role in \('owner', 'admin', 'manager'\)\s*and actor_role collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint purchase_decision_events_decision_type_check\s+check \(\s*decision_type in \(\s*'approve',\s*'approve_with_override',\s*'dismiss',\s*'undo',\s*'exclude_from_learning'\s*\)\s*and decision_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`actor_role collate "C" ~ '${TOKEN_PATTERN}'`),
    "actor_role CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`decision_type collate "C" ~ '${TOKEN_PATTERN}'`),
    "decision_type CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'owner'") &&
      migration.includes("'admin'") &&
      migration.includes("'manager'"),
    "exact actor_role allowlist must be preserved"
  );
  assert.ok(
    migration.includes("'approve'") &&
      migration.includes("'approve_with_override'") &&
      migration.includes("'dismiss'") &&
      migration.includes("'undo'") &&
      migration.includes("'exclude_from_learning'"),
    "exact decision_type allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /record_purchase_decision/i);
  assert.doesNotMatch(sqlBody, /purchase_decision_actor_role/i);
  assert.doesNotMatch(sqlBody, /purchase_decision_events_shape_check/i);
  assert.doesNotMatch(sqlBody, /source_event_key/i);
  assert.doesNotMatch(sqlBody, /evidence_version/i);
  assert.doesNotMatch(sqlBody, /canonical_unit/i);
  assert.doesNotMatch(sqlBody, /recommendation_source/i);
  assert.doesNotMatch(sqlBody, /operational_finding_decisions/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_lines/i);
});

test("original purchase_decision actor_role/decision_type used bare IN without COLLATE C shape", () => {
  assert.match(
    original,
    /actor_role text not null check \(actor_role in \('owner', 'admin', 'manager'\)\)/
  );
  assert.match(
    original,
    /decision_type text not null check \(\s*decision_type in \(\s*'approve', 'approve_with_override', 'dismiss', 'undo',\s*'exclude_from_learning'\s*\)\s*\)/
  );
  assert.doesNotMatch(
    original,
    /actor_role collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    original,
    /decision_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins purchase_decision vocabulary to COLLATE C", () => {
  assert.match(pgTap, /select plan\(24\)/);
  assert.match(pgTap, /purchase_decision_events_actor_role_check exists/);
  assert.match(
    pgTap,
    /purchase_decision_events actor_role CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /purchase_decision_events actor_role CHECK uses COLLATE C/
  );
  assert.match(pgTap, /purchase_decision_events_decision_type_check exists/);
  assert.match(
    pgTap,
    /purchase_decision_events decision_type CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /purchase_decision_events decision_type CHECK uses COLLATE C/
  );
  assert.match(pgTap, /writer token owner matches under COLLATE C/);
  assert.match(pgTap, /writer token admin matches under COLLATE C/);
  assert.match(pgTap, /writer token manager matches under COLLATE C/);
  assert.match(pgTap, /writer token approve matches under COLLATE C/);
  assert.match(
    pgTap,
    /writer token approve_with_override matches under COLLATE C/
  );
  assert.match(pgTap, /writer token dismiss matches under COLLATE C/);
  assert.match(pgTap, /writer token undo matches under COLLATE C/);
  assert.match(
    pgTap,
    /writer token exclude_from_learning matches under COLLATE C/
  );
  assert.match(pgTap, /spaced actor_role token is rejected under COLLATE C/);
  assert.match(pgTap, /spaced decision_type token is rejected under COLLATE C/);
  assert.match(pgTap, /empty actor_role token is rejected under COLLATE C/);
  assert.match(pgTap, /empty decision_type token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /punctuated actor_role token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /punctuated decision_type token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII actor_role token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII decision_type token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /all allowlisted actor_role tokens match under COLLATE C/
  );
  assert.match(
    pgTap,
    /all allowlisted decision_type tokens match under COLLATE C/
  );
});
