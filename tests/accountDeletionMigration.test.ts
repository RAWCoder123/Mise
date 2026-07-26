import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const durableAuditMigration = readFileSync(
  "supabase/migrations/20260726214500_account_deletion_durable_audit.sql",
  "utf8"
);
const deleteAccountEdge = readFileSync("supabase/functions/delete-account/index.ts", "utf8");

test("account deletion plan is written before any tenant wipe", () => {
  assert.match(durableAuditMigration, /create table if not exists private\.account_deletion_audit/i);
  assert.match(durableAuditMigration, /planned_user_id uuid not null/i);
  assert.match(
    durableAuditMigration,
    /create or replace function public\.service_plan_account_deletion/i
  );
  assert.match(durableAuditMigration, /'phase',\s*'deletion_planned'/i);

  const planFnAt = durableAuditMigration.search(
    /create or replace function private\.service_plan_account_deletion/i
  );
  const finalizeFnAt = durableAuditMigration.search(
    /create or replace function private\.service_finalize_account_deletion/i
  );
  const deleteRestaurantsAt = durableAuditMigration.search(/delete from public\.restaurants/i);
  assert.ok(planFnAt >= 0 && finalizeFnAt > planFnAt);
  assert.ok(deleteRestaurantsAt > finalizeFnAt, "restaurant deletes must live only in finalize");
  assert.doesNotMatch(
    durableAuditMigration.slice(planFnAt, finalizeFnAt),
    /delete from public\.restaurants/i
  );
  assert.doesNotMatch(
    durableAuditMigration.slice(planFnAt, finalizeFnAt),
    /delete from public\.restaurant_memberships/i
  );
});

test("finalize separates auth-failure retryability from post-auth tenant cleanup", () => {
  assert.match(durableAuditMigration, /auth_deletion_failed/);
  assert.match(durableAuditMigration, /auth_deletion_completed/);
  assert.match(durableAuditMigration, /tenant_cleanup_completed/);
  assert.match(durableAuditMigration, /tenant_cleanup_failed/);
  assert.match(durableAuditMigration, /'retryable',\s*true/);
  assert.match(
    durableAuditMigration,
    /create or replace function public\.service_finalize_account_deletion/i
  );
  assert.match(
    durableAuditMigration,
    /grant execute on function public\.service_finalize_account_deletion\(uuid, text\) to service_role/i
  );
});

test("Edge authorizes, plans without wipe, deletes auth, then finalizes cleanup by audit_id", () => {
  const authorizeAt = deleteAccountEdge.indexOf('"account_deletion_authorized"');
  const planCallAt = deleteAccountEdge.indexOf("service_plan_account_deletion");
  const authDeleteAt = deleteAccountEdge.indexOf("auth.admin.deleteUser", planCallAt);
  const finalizeSuccessAt = deleteAccountEdge.indexOf(
    'p_auth_outcome: "auth_deletion_completed"'
  );

  assert.ok(authorizeAt >= 0);
  assert.ok(planCallAt > authorizeAt, "plan must follow authorization close");
  assert.ok(authDeleteAt > planCallAt, "auth deletion must follow plan");
  assert.ok(finalizeSuccessAt > authDeleteAt, "tenant finalize must follow auth deletion");

  assert.match(deleteAccountEdge, /deletion_planned/);
  assert.match(deleteAccountEdge, /auth_deletion_failed/);
  assert.match(deleteAccountEdge, /auth_deletion_completed/);
  assert.match(deleteAccountEdge, /tenant_cleanup_completed/);
  assert.match(deleteAccountEdge, /tenant_cleanup_failed/);
  assert.match(deleteAccountEdge, /Your restaurant access is unchanged — try again/);

  // Ensure Edge never calls the old wipe-before-auth RPC.
  assert.doesNotMatch(deleteAccountEdge, /service_delete_account/);
});

test("both failure boundaries report bounded captureFunctionError telemetry", () => {
  assert.match(
    deleteAccountEdge,
    /step:\s*"auth_user_deletion"[\s\S]*phase:\s*"post_authorization"/
  );
  assert.match(
    deleteAccountEdge,
    /p_auth_outcome:\s*"auth_deletion_failed"/
  );
  assert.match(
    deleteAccountEdge,
    /step:\s*"tenant_cleanup"[\s\S]*phase:\s*"post_auth_deletion"|step:\s*"tenant_cleanup"[\s\S]*phase:\s*"tenant_cleanup_failed"/
  );
  assert.match(deleteAccountEdge, /captureFunctionError\s*\(/);
});
