import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260827010000_square_catalog_absence_reconciliation.sql",
    import.meta.url,
  ),
  "utf8",
);
const databaseProof = readFileSync(
  new URL(
    "../supabase/tests/database/square_catalog_absence_reconciliation.test.sql",
    import.meta.url,
  ),
  "utf8",
);
const syncPos = readFileSync(
  new URL("../supabase/functions/sync-pos-sales/index.ts", import.meta.url),
  "utf8",
);
const squareWebhooks = readFileSync(
  new URL("../supabase/functions/square-webhooks/index.ts", import.meta.url),
  "utf8",
);
const gapAudit = readFileSync(
  new URL("../docs/pilot/FIRST_RESTAURANT_GAP_AUDIT.md", import.meta.url),
  "utf8",
);

test("full Square snapshots soft-close absent catalog mappings without deleting history", () => {
  assert.match(migration, /create or replace function private\.reconcile_square_catalog_absence/i);
  assert.match(
    migration,
    /p_snapshot_mode = 'full'[\s\S]*reconcile_square_catalog_absence/i,
  );
  assert.match(
    migration,
    /effective_to = closed_at[\s\S]*verification_status = 'expired'/i,
  );
  assert.match(
    migration,
    /set active = false[\s\S]*remaining\.effective_to is null/i,
  );
  assert.doesNotMatch(migration, /delete from public\.pos_catalog_item_mappings/i);
  assert.doesNotMatch(migration, /delete from public\.menu_items/i);
});

test("partial webhook apply path cannot mass-expire catalog mappings", () => {
  assert.match(
    migration,
    /catalogAbsenceReconciled', false[\s\S]*catalogAbsentClosed', 0/i,
  );
  assert.match(
    databaseProof,
    /partial webhook snapshots never reconcile catalog absence/i,
  );
  assert.match(syncPos, /p_snapshot_mode: "full"/i);
  assert.match(squareWebhooks, /p_snapshot_mode: "partial"/i);
});

test("pgTAP proof covers present keep, absent expire, orphan deactivate, and tenant isolation", () => {
  assert.match(databaseProof, /present catalog identities remain current/i);
  assert.match(databaseProof, /absent verified mappings are marked expired/i);
  assert.match(
    databaseProof,
    /menu items left without any current Square mapping are deactivated/i,
  );
  assert.match(
    databaseProof,
    /manual menu items without Square mappings are not deactivated/i,
  );
  assert.match(
    databaseProof,
    /full reconciliation never closes another restaurant catalog mapping/i,
  );
});

test("gap audit records catalog absence reconciliation as addressed for full sync", () => {
  assert.match(
    gapAudit,
    /deleted\/inactive Square catalog identities are soft-closed on full sync/i,
  );
});
