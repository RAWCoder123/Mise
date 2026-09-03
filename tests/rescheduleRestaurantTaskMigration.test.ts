import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260903230000_reschedule_restaurant_task.sql",
  "utf8"
);
const pgTap = readFileSync(
  "supabase/tests/database/reschedule_restaurant_task.test.sql",
  "utf8"
);
const foundation = readFileSync(
  "supabase/migrations/20260802222329_shared_restaurant_tasks.sql",
  "utf8"
);

test("reschedule restaurant task RPC is manager-only, auditable, and open-task gated", () => {
  assert.match(migration, /create or replace function public\.reschedule_restaurant_task/i);
  assert.match(
    migration,
    /grant execute on function public\.reschedule_restaurant_task[\s\S]*to authenticated/i
  );
  assert.match(migration, /Manager role required to reschedule a task/i);
  assert.match(migration, /Only open restaurant tasks can be rescheduled/i);
  assert.match(migration, /'task_rescheduled'/);
  assert.match(migration, /timing_bucket = p_timing_bucket/);
  assert.match(migration, /due_at = p_due_at/);
  assert.match(migration, /previousTimingBucket/);
  assert.match(migration, /previousDueAt/);
});

test("reschedule vocabulary extends the shared-task activity allowlist without dropping prior task events", () => {
  for (const eventType of [
    "task_created",
    "task_completed",
    "task_reopened",
    "task_unblocked",
    "task_cancelled",
    "task_reassigned",
    "task_rescheduled"
  ]) {
    assert.match(migration, new RegExp(`'${eventType}'`));
  }
  assert.match(foundation, /'task_reopened'/);
  assert.match(foundation, /timing_bucket text not null default 'now'/);
});

test("database coverage exercises reschedule isolation, role gates, and idempotent replay", () => {
  for (const phrase of [
    "a manager can reschedule an open task timing bucket and due time",
    "reschedule replay stays idempotent",
    "reschedule appends one task_rescheduled activity event",
    "a manager can clear due_at while moving the timing bucket",
    "invalid timing buckets are rejected",
    "staff cannot reschedule a restaurant task",
    "completed tasks cannot be rescheduled"
  ]) {
    assert.match(pgTap, new RegExp(phrase, "i"));
  }
});
