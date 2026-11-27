import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateRestaurantMemoryDecisionTimeEvidence } from "../services/domain/restaurantMemoryDecisionTimeEvidence";

const migrationPath =
  "supabase/migrations/20261127120000_restaurant_memory_decision_time_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/restaurant_memory_decision_time_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/restaurantMemoryDecisionTimeEvidence.ts",
  "utf8"
);
const foundationMigration = readFileSync(
  "supabase/migrations/20260802204120_operational_backend_foundation.sql",
  "utf8"
);

test("validateRestaurantMemoryDecisionTimeEvidence rejects decision status without corrected_at", () => {
  assert.equal(
    validateRestaurantMemoryDecisionTimeEvidence({
      status: "corrected",
      correctedAt: null,
    }),
    "missing_corrected_at"
  );
  assert.equal(
    validateRestaurantMemoryDecisionTimeEvidence({
      status: "corrected",
      correctedAt: "   ",
    }),
    "missing_corrected_at"
  );
  assert.equal(
    validateRestaurantMemoryDecisionTimeEvidence({
      status: "dismissed",
      correctedAt: undefined,
    }),
    "missing_corrected_at"
  );
  assert.equal(
    validateRestaurantMemoryDecisionTimeEvidence({
      status: "confirmed",
      correctedAt: "",
    }),
    "missing_corrected_at"
  );
  assert.equal(
    validateRestaurantMemoryDecisionTimeEvidence({
      status: "forgotten",
      correctedAt: null,
    }),
    "missing_corrected_at"
  );
  assert.equal(
    validateRestaurantMemoryDecisionTimeEvidence({
      status: "disabled",
      correctedAt: null,
    }),
    "missing_corrected_at"
  );
});

test("validateRestaurantMemoryDecisionTimeEvidence accepts active and stamped decision statuses", () => {
  assert.equal(
    validateRestaurantMemoryDecisionTimeEvidence({
      status: "active",
    }),
    null
  );
  assert.equal(
    validateRestaurantMemoryDecisionTimeEvidence({
      status: "corrected",
      correctedAt: "2026-11-27T12:00:00Z",
    }),
    null
  );
  assert.equal(
    validateRestaurantMemoryDecisionTimeEvidence({
      status: "dismissed",
      correctedAt: "2026-11-27T12:00:00Z",
    }),
    null
  );
  assert.equal(
    validateRestaurantMemoryDecisionTimeEvidence({
      status: "confirmed",
      correctedAt: "2026-11-27T12:00:00Z",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT decision-time guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_restaurant_memory_decision_time_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.restaurant_memories[\s\S]*enforce_restaurant_memory_decision_time_evidence/
  );
  assert.match(migration, /Restaurant memory decision time is required/);
  // No table-level NOT NULL / status-implies-timestamp CHECK — tip stays
  // INSERT-only and orthogonal to the companion corrected_by actor tip.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+corrected_at\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,160}corrected_at\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.update_restaurant_memory/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_restaurant_memory_decision_time_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_corrected_at/);
  // Hosted writer stamps corrected_at via UPDATE; column stays nullable.
  assert.match(foundationMigration, /corrected_at = now\(\)/);
  assert.match(foundationMigration, /corrected_at timestamptz,/);
});

test("pgTAP plan equals assertion call sites and covers null decision time plus UPDATE stamp", () => {
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
  assert.equal(planned, 10);
  assert.match(pgTap, /Restaurant memory decision time is required/);
  assert.match(pgTap, /update_restaurant_memory/);
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /delete from auth\.users/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
