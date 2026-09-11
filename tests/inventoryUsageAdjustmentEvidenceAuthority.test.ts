import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260904140000_inventory_usage_adjustment_evidence.sql",
  "utf8"
);
const ledger = readFileSync("services/domain/inventoryLedger.ts", "utf8");
const evidence = readFileSync(
  "services/domain/inventoryUsageAdjustmentEvidence.ts",
  "utf8"
);
const pgTap = readFileSync(
  "supabase/tests/database/inventory_usage_adjustment_evidence.test.sql",
  "utf8"
);

test("hosted usage and adjustment events require allowlisted reason and note", () => {
  assert.match(migration, /enforce_inventory_usage_adjustment_evidence/);
  assert.match(migration, /inventory_events_usage_adjustment_evidence/);
  assert.match(migration, /Inventory usage events require a reason code/);
  assert.match(migration, /Inventory usage events require a note/);
  assert.match(migration, /Inventory adjustment events require a reason code/);
  assert.match(migration, /Inventory adjustment events require a note/);
  assert.match(
    migration,
    /'prep', 'staff_meal', 'tasting', 'training', 'other'/
  );
  assert.match(migration, /'found', 'lost', 'recount_delta', 'other'/);
  assert.match(migration, /not valid/i);
  assert.match(
    migration,
    /revoke all on function private\.enforce_inventory_usage_adjustment_evidence\(\)[\s\S]*from public, anon, authenticated, service_role/
  );
  assert.doesNotMatch(migration, /create or replace function public\.record_inventory_event/);
});

test("domain ledger validates usage and adjustment evidence", () => {
  assert.match(ledger, /validateUsageOrAdjustmentEvidence/);
  assert.match(evidence, /usage_requires_reason/);
  assert.match(evidence, /adjustment_requires_note/);
  assert.match(evidence, /INVENTORY_USAGE_REASON_CODES/);
  assert.match(evidence, /INVENTORY_ADJUSTMENT_REASON_CODES/);
});

test("pgTAP covers bare and allowlisted usage/adjustment RPC paths", () => {
  assert.match(pgTap, /bare usage without reason is rejected/);
  assert.match(pgTap, /bare adjustment without note is rejected/);
  assert.match(pgTap, /allowlisted usage with note is accepted/);
  assert.match(pgTap, /allowlisted adjustment with note is accepted/);
  assert.match(pgTap, /operator_usage/);
  assert.match(pgTap, /operator_adjustment/);
});
