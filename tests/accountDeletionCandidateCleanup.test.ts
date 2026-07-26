import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260726223000_account_deletion_candidate_cleanup.sql",
  "utf8"
);

test("account deletion finalization uses durable owner candidates after membership cascade", () => {
  assert.match(migration, /owned\.role = 'owner'/i);
  assert.match(migration, /owned\.status = 'active'/i);
  assert.match(
    migration,
    /pg_catalog\.unnest\(v_row\.planned_deleted_restaurant_ids\)/i
  );
  assert.match(migration, /remaining_owner\.role = 'owner'/i);
  assert.match(migration, /remaining_owner\.status = 'active'/i);
  assert.match(migration, /Auth user must be deleted before tenant cleanup/i);
  assert.doesNotMatch(
    migration.slice(
      migration.indexOf("create or replace function private.service_finalize_account_deletion")
    ),
    /where owned\.user_id = v_row\.planned_user_id/i
  );
});
