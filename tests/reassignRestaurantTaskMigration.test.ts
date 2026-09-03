import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260903201000_reassign_restaurant_task.sql",
  "utf8"
);
const pgTap = readFileSync(
  "supabase/tests/database/reassign_restaurant_task.test.sql",
  "utf8"
);
const foundation = readFileSync(
  "supabase/migrations/20260802222329_shared_restaurant_tasks.sql",
  "utf8"
);

test("reassign restaurant task RPC is manager-only, auditable, and open-task gated", () => {
  assert.match(migration, /create or replace function public\.reassign_restaurant_task/i);
  assert.match(
    migration,
    /grant execute on function public\.reassign_restaurant_task[\s\S]*to authenticated/i
  );
  assert.match(migration, /Manager role required to reassign a task/i);
  assert.match(migration, /Only open restaurant tasks can be reassigned/i);
  assert.match(migration, /'task_reassigned'/);
  assert.match(migration, /assignee_user_id = p_assignee_user_id/);
  assert.match(migration, /previousAssigneeUserId/);
});

test("reassign vocabulary extends the shared-task activity allowlist without dropping prior task events", () => {
  for (const eventType of [
    "task_created",
    "task_completed",
    "task_reopened",
    "task_unblocked",
    "task_cancelled",
    "task_reassigned"
  ]) {
    assert.match(migration, new RegExp(`'${eventType}'`));
  }
  assert.match(foundation, /'task_reopened'/);
  assert.match(foundation, /private\.enforce_restaurant_task_assignee/);
});

test("database coverage exercises reassignment isolation, role gates, and idempotent replay", () => {
  for (const phrase of [
    "a manager can reassign an open task to staff",
    "reassign replay stays idempotent",
    "reassign appends one task_reassigned activity event",
    "staff cannot reassign a restaurant task",
    "completed tasks cannot be reassigned",
    "assignee must hold the required active restaurant role"
  ]) {
    assert.match(pgTap, new RegExp(phrase, "i"));
  }
});
