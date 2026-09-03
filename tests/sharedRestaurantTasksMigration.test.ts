import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260802222329_shared_restaurant_tasks.sql",
  "utf8"
);
const pgTap = readFileSync(
  "supabase/tests/database/shared_restaurant_tasks.test.sql",
  "utf8"
);

test("shared task tables are tenant-scoped, RLS protected, and not directly writable", () => {
  for (const table of ["restaurant_tasks", "restaurant_task_dependencies"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(migration, new RegExp(`grant select on public\\.${table} to authenticated`, "i"));
    assert.doesNotMatch(
      migration,
      new RegExp(`grant (?:insert|update|delete|all)[^;]*on public\\.${table} to authenticated`, "i")
    );
  }
  assert.match(migration, /private\.is_restaurant_member\(restaurant_id\)/);
  assert.match(migration, /before insert or update or delete on public\.restaurant_tasks/);
  assert.match(migration, /before insert or update or delete on public\.restaurant_task_dependencies/);
});

test("shared task RPCs derive actor authority and preserve verified completion truth", () => {
  for (const rpc of ["create_restaurant_task", "complete_restaurant_task", "reopen_restaurant_task"]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${rpc}`, "i"));
    assert.match(migration, new RegExp(`grant execute on function public\\.${rpc}[\\s\\S]*to authenticated`, "i"));
  }
  assert.match(migration, /actor_user_id uuid := auth\.uid\(\)/);
  assert.match(migration, /task prerequisites are not complete/i);
  assert.match(migration, /verification evidence is required for this task/i);
  assert.match(migration, /completion_result = trim\(p_completion_result\)/);
  assert.match(migration, /'task_unblocked'/);
  assert.match(migration, /'task_reopened'/);
  assert.match(
    migration,
    /on conflict\s*\(restaurant_id, idempotency_key\)\s*do nothing/i
  );
  const cancelMigration = readFileSync(
    "supabase/migrations/20260903193000_cancel_restaurant_task.sql",
    "utf8"
  );
  assert.match(cancelMigration, /create or replace function public\.cancel_restaurant_task/i);
  assert.match(cancelMigration, /'task_cancelled'/);
});

test("database coverage exercises isolation, assignment, cycles, evidence, and unblocking", () => {
  for (const phrase of [
    "RLS hides another tenant task rows",
    "a task cannot be assigned to another tenant member",
    "dependency cycles are rejected",
    "verification-required tasks reject evidence-free completion",
    "completing the prerequisite unblocks its dependent task",
    "staff cannot fabricate a Mise-created task"
  ]) {
    assert.match(pgTap, new RegExp(phrase, "i"));
  }
});
