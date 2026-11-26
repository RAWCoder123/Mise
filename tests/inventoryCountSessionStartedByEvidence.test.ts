import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateInventoryCountSessionStartedByEvidence } from "../services/domain/inventoryCountSessionStartedByEvidence";

const migrationPath =
  "supabase/migrations/20261126230000_inventory_count_session_started_by_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/inventory_count_session_started_by_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/inventoryCountSessionStartedByEvidence.ts",
  "utf8"
);
const countSessionMigration = readFileSync(
  "supabase/migrations/20260810140000_inventory_count_sessions_ledger.sql",
  "utf8"
);

test("validateInventoryCountSessionStartedByEvidence rejects null, undefined, and blank starters", () => {
  assert.equal(
    validateInventoryCountSessionStartedByEvidence({ startedBy: null }),
    "missing_started_by"
  );
  assert.equal(
    validateInventoryCountSessionStartedByEvidence({
      startedBy: undefined,
    }),
    "missing_started_by"
  );
  assert.equal(
    validateInventoryCountSessionStartedByEvidence({ startedBy: "" }),
    "missing_started_by"
  );
  assert.equal(
    validateInventoryCountSessionStartedByEvidence({
      startedBy: "   ",
    }),
    "missing_started_by"
  );
});

test("validateInventoryCountSessionStartedByEvidence accepts a non-empty starter id", () => {
  assert.equal(
    validateInventoryCountSessionStartedByEvidence({
      startedBy: "user-manager-1",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT starter guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_inventory_count_session_started_by_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.inventory_count_sessions[\s\S]*enforce_inventory_count_session_started_by_evidence/
  );
  assert.match(migration, /Inventory count session starter is required/);
  // No table-level NOT NULL restore — that would block auth anonymization UPDATEs.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+started_by\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,120}started_by\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_begin_inventory_count_session/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.service_begin_inventory_count_session/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_approve_inventory_count_session/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_inventory_count_session_started_by_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_started_by/);
  // Hosted writer already stamps p_actor_user_id; anonymization escape already exists.
  assert.match(
    countSessionMigration,
    /insert into public\.inventory_count_sessions\s*\(\s*restaurant_id, status, started_by/
  );
  assert.match(
    countSessionMigration,
    /started_by uuid references auth\.users\(id\) on delete set null/
  );
});

test("pgTAP plan equals assertion call sites and covers null insert plus anonymization", () => {
  const planMatch = /select plan\((\d+)\);/.exec(pgTap);
  assert.ok(planMatch);
  const planned = Number(planMatch![1]);
  const assertionSites = [
    ...pgTap.matchAll(/^select (is|isnt|ok|matches|has_function)\(/gm),
  ].length;
  assert.equal(
    planned,
    assertionSites,
    "plan must be derived from assertion call sites, never from a passing run"
  );
  assert.equal(planned, 8);
  assert.match(pgTap, /Inventory count session starter is required/);
  assert.match(pgTap, /started_by[\s\S]*null/);
  assert.match(pgTap, /delete from auth\.users/);
  assert.match(pgTap, /service_begin_inventory_count_session/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
