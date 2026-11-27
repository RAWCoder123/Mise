import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateAuditLogActorEvidence } from "../services/domain/auditLogActorEvidence";

const migrationPath =
  "supabase/migrations/20261127060000_audit_log_actor_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/audit_log_actor_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/auditLogActorEvidence.ts",
  "utf8"
);
const backboneMigration = readFileSync(
  "supabase/migrations/202606210002_restaurant_ops_backbone.sql",
  "utf8"
);
const edgeAuditMigration = readFileSync(
  "supabase/migrations/20260716204112_reinforce_tenant_isolation.sql",
  "utf8"
);

test("validateAuditLogActorEvidence rejects null, undefined, and blank actors", () => {
  assert.equal(
    validateAuditLogActorEvidence({ actorUserId: null }),
    "missing_actor_user_id"
  );
  assert.equal(
    validateAuditLogActorEvidence({ actorUserId: undefined }),
    "missing_actor_user_id"
  );
  assert.equal(
    validateAuditLogActorEvidence({ actorUserId: "" }),
    "missing_actor_user_id"
  );
  assert.equal(
    validateAuditLogActorEvidence({ actorUserId: "   " }),
    "missing_actor_user_id"
  );
});

test("validateAuditLogActorEvidence accepts a non-empty actor id", () => {
  assert.equal(
    validateAuditLogActorEvidence({ actorUserId: "user-manager-1" }),
    null
  );
});

test("additive migration pins the BEFORE INSERT actor guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_audit_log_actor_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.audit_logs[\s\S]*enforce_audit_log_actor_evidence/
  );
  assert.match(migration, /Audit log actor is required/);
  // No table-level NOT NULL restore — that would block auth anonymization UPDATEs.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+actor_user_id\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,120}actor_user_id\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_record_edge_audit_log/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.service_record_edge_audit_log/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_audit_log_actor_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_actor_user_id/);
  // Soft nullable actor + ON DELETE SET NULL already exist; hosted helper already rejects null.
  assert.match(
    backboneMigration,
    /actor_user_id uuid references auth\.users\(id\) on delete set null/
  );
  assert.match(
    edgeAuditMigration,
    /if p_actor_user_id is null or p_restaurant_id is null/
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
  assert.match(pgTap, /Audit log actor is required/);
  assert.match(pgTap, /actor_user_id[\s\S]*null/);
  assert.match(pgTap, /delete from auth\.users/);
  assert.match(pgTap, /service_record_edge_audit_log/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
