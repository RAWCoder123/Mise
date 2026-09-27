import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927180000_mise_005au_restaurant_task_client_task_id_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalTasks = readFileSync(
  new URL(
    "../supabase/migrations/20260802222329_shared_restaurant_tasks.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/restaurant_task_client_task_id_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const createTaskUi = readFileSync(
  new URL("../app/more/create-task.tsx", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const CLIENT_TASK_PATTERN = "^[A-Za-z0-9:_-]{1,200}$";

test("MISE-005AU pins restaurant_tasks.client_task_id CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AU"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_tasks_client_task_id_check check \(\s*client_task_id collate "C" ~ '\^\[A-Za-z0-9:_-\]\{1,200\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`client_task_id collate "C" ~ '${CLIENT_TASK_PATTERN}'`),
    "client_task_id CHECK must pin under COLLATE C"
  );

  // Compose: CHECK-only. Do not rewrite writers or sibling pins.
  assert.doesNotMatch(sqlBody, /create or replace function public\.create_restaurant_task/i);
  assert.doesNotMatch(
    sqlBody,
    /operational_finding_decisions_client_event_id_check/i
  );
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.recalculation_runs/i);
  assert.doesNotMatch(
    sqlBody,
    /alter table public\.operational_finding_decisions/i
  );
});

test("original restaurant_tasks.client_task_id CHECK was length-only", () => {
  assert.match(
    originalTasks,
    /client_task_id text not null check \(length\(trim\(client_task_id\)\) between 1 and 200\)/
  );
  assert.doesNotMatch(
    originalTasks,
    /client_task_id collate "C" ~ '\^\[A-Za-z0-9:_-\]\{1,200\}\$'/
  );

  assert.match(
    createTaskUi,
    /clientTaskId:\s*`restaurant-task:\$\{Date\.now\(\)\}:\$\{Math\.random\(\)\.toString\(36\)\.slice\(2, 10\)\}`/
  );
});

test("pgTAP fixture pins restaurant_tasks.client_task_id shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(7\)/);
  assert.match(pgTap, /restaurant_tasks_client_task_id_check exists/);
  assert.match(pgTap, /restaurant_tasks client_task_id CHECK uses COLLATE C/);
  assert.match(
    pgTap,
    /restaurant_tasks client_task_id CHECK is not length-only/
  );
  assert.match(
    pgTap,
    /writer client_task_id restaurant-task mint matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /fixture client_task_id hyphenated mint matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /spaced restaurant-task client_task_id is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /empty restaurant-task client_task_id is rejected under COLLATE C/
  );
});
