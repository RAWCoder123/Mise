import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260904120000_inventory_correction_requires_supersede.sql",
  "utf8"
);
const ledger = readFileSync("services/domain/inventoryLedger.ts", "utf8");
const pgTap = readFileSync("supabase/tests/database/inventory_event_ledger.test.sql", "utf8");

test("hosted corrections must supersede a prior ledger event", () => {
  assert.match(migration, /enforce_inventory_correction_supersede/);
  assert.match(
    migration,
    /Inventory corrections must supersede a prior ledger event/
  );
  assert.match(
    migration,
    /inventory_events_correction_requires_supersede/
  );
  assert.match(
    migration,
    /\(event_type = 'correction'\) = \(supersedes_event_id is not null\)/
  );
  assert.match(migration, /not valid/i);
  assert.match(
    migration,
    /revoke all on function private\.enforce_inventory_correction_supersede\(\)[\s\S]*from public, anon, authenticated, service_role/i
  );
});

test("domain and pgTAP reject orphan inventory corrections", () => {
  assert.match(ledger, /correction_requires_supersede/);
  assert.match(
    ledger,
    /eventType === "correction" && !input\.candidate\.supersedesEventId\?\.trim\(\)/
  );
  assert.match(pgTap, /orphan inventory corrections are rejected/);
  assert.match(pgTap, /a linked inventory correction is accepted/);
  assert.match(pgTap, /an inventory event can be superseded only once/);
});
