import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  fromPosPlanningSignalsRefreshed,
  fromPosSyncCompleted,
  groupRelatedActivities,
  posSyncPlanningSequenceId
} from "../services/domain/activityEvents";

const root = process.cwd();

test("hosted Square sync hands the import id to refresh_signals for correlation", () => {
  const syncPos = readFileSync(
    path.join(root, "supabase/functions/sync-pos-sales/index.ts"),
    "utf8"
  );
  assert.match(syncPos, /syncImportId:\s*applied\?\.importId/);
  assert.match(syncPos, /action:\s*"refresh_signals"/);
});

test("operational-workflows records a planning beat on the pos-sync sequence", () => {
  const workflows = readFileSync(
    path.join(root, "supabase/functions/operational-workflows/index.ts"),
    "utf8"
  );
  assert.match(workflows, /fromPosPlanningSignalsRefreshed/);
  assert.match(workflows, /maybeRecordPosSyncPlanningActivity/);
  assert.match(workflows, /service_append_activity_event/);
  assert.match(workflows, /action === "refresh_signals"/);
  assert.match(workflows, /posSyncPlanningSequenceId/);
});

test("demo sync helper emits correlated sync and planning activity", () => {
  const demoActivity = readFileSync(
    path.join(root, "services/demo/demoActivity.ts"),
    "utf8"
  );
  const demoRepo = readFileSync(
    path.join(root, "services/repositories/demoRepository.ts"),
    "utf8"
  );
  assert.match(demoActivity, /appendDemoPosSyncPlanningActivity/);
  assert.match(demoActivity, /fromPosPlanningSignalsRefreshed/);
  assert.match(demoRepo, /appendDemoPosSyncPlanningActivity/);
  assert.match(demoRepo, /rebuildPurchaseRecommendations/);
});

test("pos-sync sequence matches the hosted sales_imports activity key", () => {
  const foundation = readFileSync(
    path.join(root, "supabase/migrations/20260802204120_operational_backend_foundation.sql"),
    "utf8"
  );
  assert.match(foundation, /event_sequence := format\('pos-sync:%s', new\.id\)/);
  assert.equal(
    posSyncPlanningSequenceId("cccccccc-3333-4333-8333-cccccccccccc"),
    "pos-sync:cccccccc-3333-4333-8333-cccccccccccc"
  );

  const importId = "cccccccc-3333-4333-8333-cccccccccccc";
  const story = groupRelatedActivities([
    fromPosSyncCompleted({
      restaurantId: "rest_corr",
      occurredAt: "2026-08-26T21:00:00.000Z",
      importId,
      recordsProcessed: 10
    }),
    fromPosPlanningSignalsRefreshed({
      restaurantId: "rest_corr",
      occurredAt: "2026-08-26T21:00:01.000Z",
      importId,
      recommendationCount: 2
    })
  ]).find((entry) => entry.sequenceId === `pos-sync:${importId}`);
  assert.ok(story);
  assert.equal(story!.events.length, 2);
});
