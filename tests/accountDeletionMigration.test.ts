import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const durableAuditMigration = readFileSync(
  "supabase/migrations/20260726214500_account_deletion_durable_audit.sql",
  "utf8"
);
const candidateCleanupMigration = readFileSync(
  "supabase/migrations/20260726223000_account_deletion_candidate_cleanup.sql",
  "utf8"
);
const deleteAccountEdge = readFileSync("supabase/functions/delete-account/index.ts", "utf8");
const supabaseRepository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");

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

test("plan captures all owner-restaurant candidates; finalize filters by remaining owners", () => {
  const planFnAt = durableAuditMigration.search(
    /create or replace function private\.service_plan_account_deletion/i
  );
  const finalizeFnAt = durableAuditMigration.search(
    /create or replace function private\.service_finalize_account_deletion/i
  );
  const planBody = durableAuditMigration.slice(planFnAt, finalizeFnAt);
  const finalizeBody = durableAuditMigration.slice(finalizeFnAt);

  // Planning must retain every active owner restaurant, not only then-sole-owner.
  assert.match(planBody, /owned\.role = 'owner'/i);
  assert.match(planBody, /owned\.status = 'active'/i);
  assert.match(planBody, /owner_restaurant_candidates/i);
  assert.doesNotMatch(
    planBody,
    /and not exists \(\s*select 1\s*from public\.restaurant_memberships other/i
  );

  // After auth cascade, finalize must use the durable plan — never recompute by planned_user_id.
  assert.match(
    finalizeBody,
    /pg_catalog\.unnest\(v_row\.planned_deleted_restaurant_ids\)/i
  );
  assert.match(finalizeBody, /remaining_owner\.role = 'owner'/i);
  assert.match(finalizeBody, /remaining_owner\.status = 'active'/i);
  assert.doesNotMatch(finalizeBody, /where owned\.user_id = v_row\.planned_user_id/i);
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
  // Search after the plan RPC call so header comments mentioning auth.admin.deleteUser
  // cannot satisfy the ordering assertion.
  const authDeleteAt = deleteAccountEdge.indexOf(
    "securitySupabase.auth.admin.deleteUser",
    planCallAt + 1
  );
  const finalizeSuccessAt = deleteAccountEdge.indexOf(
    'p_auth_outcome: "auth_deletion_completed"',
    authDeleteAt + 1
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
  assert.match(deleteAccountEdge, /deletionReference:\s*auditId/);
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

test("post-auth cleanup failures preserve the deletion reference for support", () => {
  assert.match(deleteAccountEdge, /deletionReference:\s*auditId/);
  assert.match(supabaseRepository, /payload\.deletionReference/);
  assert.match(supabaseRepository, /Reference:\s*\$\{deletionReference\}/);
});

test("account deletion path never mutates inventory_events (inventory FK owns actor anonymization)", () => {
  // Inventory actor nulling is Codex-owned via auth.users FK ON DELETE SET NULL.
  // Account-deletion plan/finalize and Edge must not UPDATE/DELETE inventory_events.
  for (const source of [durableAuditMigration, candidateCleanupMigration, deleteAccountEdge]) {
    assert.doesNotMatch(source, /update\s+(?:only\s+)?(?:public\.)?inventory_events/i);
    assert.doesNotMatch(source, /delete\s+from\s+(?:public\.)?inventory_events/i);
  }
  assert.match(
    deleteAccountEdge,
    /never UPDATEs\/DELETEs inventory_events|inventory_events\.actor_user_id/
  );
});
