import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260903193000_cancel_restaurant_task.sql",
  "utf8"
);
const pgTap = readFileSync(
  "supabase/tests/database/shared_restaurant_tasks.test.sql",
  "utf8"
);
const foundation = readFileSync(
  "supabase/migrations/20260802222329_shared_restaurant_tasks.sql",
  "utf8"
);

test("cancel restaurant task RPC is manager-only, auditable, and fail-closed on open dependents", () => {
  assert.match(migration, /create or replace function public\.cancel_restaurant_task/i);
  assert.match(migration, /grant execute on function public\.cancel_restaurant_task[\s\S]*to authenticated/i);
  assert.match(migration, /Manager role required to cancel a task/i);
  assert.match(migration, /Open dependent tasks still require this prerequisite/i);
  assert.match(migration, /Completed tasks cannot be cancelled/i);
  assert.match(migration, /'task_cancelled'/);
  assert.match(migration, /status = 'cancelled'/);
  assert.match(migration, /Cancel reason must be 500 characters or fewer/i);
});

test("cancel vocabulary extends the shared-task activity allowlist without dropping prior task events", () => {
  for (const eventType of [
    "task_created",
    "task_completed",
    "task_reopened",
    "task_unblocked",
    "task_cancelled"
  ]) {
    assert.match(migration, new RegExp(`'${eventType}'`));
  }
  assert.match(foundation, /'task_reopened'/);
  assert.match(foundation, /'task_unblocked'/);
});

test("database coverage exercises cancel isolation, dependents, and idempotent replay", () => {
  for (const phrase of [
    "a manager can cancel an open leaf task",
    "cancelling a prerequisite with open dependents fails closed",
    "staff cannot cancel a restaurant task",
    "cancel replay stays idempotent",
    "cancel appends one task_cancelled activity event"
  ]) {
    assert.match(pgTap, new RegExp(phrase, "i"));
  }
});
