import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260804040000_staff_notification_audit_and_manual_insight_preserve.sql",
  "utf8"
);
const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
const databaseTests = readFileSync("supabase/tests/database/tenant_isolation.test.sql", "utf8");
const authorityMigration = readFileSync(
  "supabase/migrations/20260801201000_staff_edge_audit_and_signal_authority.sql",
  "utf8"
);

test("staff notification preference audits are allowlisted after the Edge mutation", () => {
  assert.match(edge, /"update_my_notification_preferences"/);
  assert.match(edge, /operator_notification_preferences_updated/);
  assert.match(
    migration,
    /staff_audit_actions text\[] := array\[[\s\S]*'operator_notification_preferences_updated'/
  );
  assert.match(
    databaseTests,
    /service audit RPC accepts staff actors for notification preference audits/i
  );
  assert.match(
    databaseTests,
    /service audit RPC still rejects staff actors for manager-only audit actions after notification allowlist/i
  );
});

test("operational signal refresh preserves manual insights like manual recommendations", () => {
  assert.match(
    authorityMigration,
    /delete from public\.purchase_recommendations[\s\S]*generation_source in \('mise_rules', 'legacy_client'\)/
  );
  assert.match(
    authorityMigration,
    /delete from public\.insights where restaurant_id = p_restaurant_id;/
  );
  assert.match(
    migration,
    /delete from public\.insights[\s\S]*generation_source in \('mise_rules', 'legacy_client'\)/
  );
  assert.doesNotMatch(
    migration,
    /delete from public\.insights where restaurant_id = p_restaurant_id;\s*\n\s*insert/
  );
  assert.match(
    databaseTests,
    /manual insights survive rules-owned operational signal refresh/i
  );
  assert.match(
    databaseTests,
    /rules-owned insights are still replaced during operational signal refresh/i
  );
});
