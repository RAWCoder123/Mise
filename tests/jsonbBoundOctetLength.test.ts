import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260925231000_mise_005e_jsonb_bound_octet_length.sql",
    import.meta.url
  ),
  "utf8"
);
const foundation = readFileSync(
  new URL(
    "../supabase/migrations/20260802204120_operational_backend_foundation.sql",
    import.meta.url
  ),
  "utf8"
);
const sharedTasks = readFileSync(
  new URL(
    "../supabase/migrations/20260802222329_shared_restaurant_tasks.sql",
    import.meta.url
  ),
  "utf8"
);
const purchaseDecision = readFileSync(
  new URL(
    "../supabase/migrations/20260824120000_mise_004a_purchase_decision_memory.sql",
    import.meta.url
  ),
  "utf8"
);
const purchaseAuthority = readFileSync(
  new URL(
    "../supabase/migrations/20260821120000_mise_003a_purchase_approval_authority.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/jsonb_bound_octet_length.test.sql",
    import.meta.url
  ),
  "utf8"
);

const CHECK_SITES = [
  "operational_issues_evidence_bound_check",
  "mise_actions_evidence_bound_check",
  "mise_actions_expected_impact_bound_check",
  "mise_actions_result_bound_check",
  "action_outcomes_payload_bound_check",
  "restaurant_memories_evidence_bound_check",
  "activity_events_evidence_bound_check",
  "activity_events_metadata_bound_check",
  "supplier_order_confirmations_details_bound_check",
  "restaurant_tasks_checklist_bound_check",
  "restaurant_tasks_evidence_bound_check",
  "purchase_decision_events_context_evidence_check",
] as const;

test("MISE-005E replaces every known pg_column_size CHECK with octet_length(...::text)", () => {
  assert.ok(migration.includes("MISE-005E"), "additive pin must stay labeled");
  for (const name of CHECK_SITES) {
    assert.match(
      migration,
      new RegExp(`drop constraint if exists ${name}`, "i"),
      `must drop ${name}`
    );
    assert.match(
      migration,
      new RegExp(`add constraint ${name}[\\s\\S]*octet_length\\([^)]*::text\\)`, "i"),
      `must re-add ${name} with octet_length(...::text)`
    );
  }
  assert.doesNotMatch(
    migration,
    /check\s*\([\s\S]*pg_column_size\s*\(/i,
    "additive migration must not leave pg_column_size inside CHECK expressions"
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.record_supplier_delivery/i,
    "must not rewrite contested receive function bodies"
  );
});

test("historical migrations still document the original pg_column_size CHECKs", () => {
  assert.match(foundation, /pg_column_size\(evidence\) <= 32768/);
  assert.match(sharedTasks, /pg_column_size\(checklist\) <= 32768/);
  assert.match(purchaseDecision, /pg_column_size\(context_evidence\) <= 8192/);
});

test("later authority and pilot bounds already used octet_length(...::text)", () => {
  assert.match(
    purchaseAuthority,
    /octet_length\(approval_authority::text\) <= 32768/
  );
  assert.match(
    purchaseAuthority,
    /octet_length\(purchase_authority::text\) <= 131072/
  );
});

test("pgTAP fixture asserts catalog constraints no longer call pg_column_size", () => {
  assert.match(pgTap, /jsonb_bound_octet_length/);
  assert.match(pgTap, /pg_get_constraintdef/);
  assert.match(pgTap, /pg_column_size/);
  assert.match(pgTap, /octet_length/);
  for (const name of CHECK_SITES) {
    assert.match(pgTap, new RegExp(name));
  }
});

test("no later migration after 005E reintroduces pg_column_size CHECK constraints", () => {
  const migrationsDir = fileURLToPath(new URL("../supabase/migrations/", import.meta.url));
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const afterPin = files.filter((name) => name > "20260925231000_mise_005e_jsonb_bound_octet_length.sql");
  for (const name of afterPin) {
    const body = readFileSync(join(migrationsDir, name), "utf8");
    assert.doesNotMatch(
      body,
      /add constraint[\s\S]{0,400}pg_column_size\s*\(/i,
      `${name} must not reintroduce pg_column_size CHECK bounds`
    );
  }
});
