import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { DEMO_RESTAURANT_ID } from "../services/demo/replaceableDemoData";
import {
  presentCountSessionHistoryAt,
  presentCountSessionStatusBadgeTone,
  presentCountSessionStatusMessageKey
} from "../services/presentation/inventoryCountSessionPresentation";
import { INVENTORY_COUNT_SESSION_HISTORY_LIMIT } from "../services/repositories/repositoryContracts";
import type { InventoryCountSession } from "../types/mise";

function sampleSession(
  overrides: Partial<InventoryCountSession> = {}
): InventoryCountSession {
  return {
    id: "session-1",
    restaurant_id: "restaurant-1",
    status: "approved",
    started_by: "user-1",
    submitted_by: "user-1",
    approved_by: "user-1",
    cancelled_by: null,
    started_at: "2026-08-28T10:00:00.000Z",
    submitted_at: "2026-08-28T10:30:00.000Z",
    approved_at: "2026-08-28T11:00:00.000Z",
    cancelled_at: null,
    note: null,
    created_at: "2026-08-28T10:00:00.000Z",
    updated_at: "2026-08-28T11:00:00.000Z",
    ...overrides
  };
}

test("count session history presentation prefers closed timestamps and status copy", () => {
  assert.equal(presentCountSessionStatusMessageKey("approved"), "inventory.count.status.approved");
  assert.equal(presentCountSessionStatusBadgeTone("approved"), "success");
  assert.equal(presentCountSessionStatusBadgeTone("cancelled"), "neutral");
  assert.equal(
    presentCountSessionHistoryAt(sampleSession()),
    "2026-08-28T11:00:00.000Z"
  );
  assert.equal(
    presentCountSessionHistoryAt(
      sampleSession({
        status: "cancelled",
        approved_at: null,
        approved_by: null,
        cancelled_by: "user-1",
        cancelled_at: "2026-08-28T10:45:00.000Z"
      })
    ),
    "2026-08-28T10:45:00.000Z"
  );
});

test("demo repository seeds and lists closed count sessions for history browse", async () => {
  const values = new Map<string, string>();
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
      clear: () => {
        values.clear();
      },
      key: (index) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      }
    }
  };

  const { createLocalDemoRepository } = await import("../services/repositories/demoRepository");
  const repository = createLocalDemoRepository();
  await repository.resetDemoData(null);

  const sessions = await repository.listInventoryCountSessions(DEMO_RESTAURANT_ID, {
    statuses: ["approved", "cancelled"],
    limit: INVENTORY_COUNT_SESSION_HISTORY_LIMIT
  });
  assert.ok(sessions.length >= 1);
  assert.ok(sessions.every((session) => session.restaurant_id === DEMO_RESTAURANT_ID));
  assert.ok(sessions.every((session) => session.status === "approved" || session.status === "cancelled"));
  assert.ok(sessions.length <= INVENTORY_COUNT_SESSION_HISTORY_LIMIT);

  const first = sessions[0]!;
  const detail = await repository.fetchInventoryCountSession(DEMO_RESTAURANT_ID, first.id);
  assert.equal(detail.session.id, first.id);
  assert.equal(detail.session.restaurant_id, DEMO_RESTAURANT_ID);
  assert.ok(detail.lines.length >= 1);
  assert.ok(detail.lines.every((line) => line.session_id === first.id));
});

test("history browse stays tenant-scoped and does not invent open sessions", async () => {
  const values = new Map<string, string>();
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
      clear: () => {
        values.clear();
      },
      key: (index) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      }
    }
  };

  const { createLocalDemoRepository } = await import("../services/repositories/demoRepository");
  const repository = createLocalDemoRepository();
  await repository.resetDemoData(null);

  const sessions = await repository.listInventoryCountSessions(DEMO_RESTAURANT_ID, {
    statuses: ["approved", "cancelled"]
  });
  assert.doesNotMatch(
    JSON.stringify(sessions),
    /"status":"(in_progress|submitted)"/
  );

  const foreign = await repository.listInventoryCountSessions(
    "00000000-0000-4000-8000-000000009999",
    { statuses: ["approved", "cancelled"] }
  );
  assert.deepEqual(foreign, []);
});

test("both repository backends bound and tenant-scope count session history lists", () => {
  const hosted = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
  const demo = readFileSync("services/repositories/demoRepository.ts", "utf8");
  const application = readFileSync("services/application/inventory.ts", "utf8");

  const hostedMethod = hosted.match(/async listInventoryCountSessions\([\s\S]*?\n    \},/)?.[0] ?? "";
  assert.match(hostedMethod, /\.from\("inventory_count_sessions"\)/);
  assert.match(hostedMethod, /\.eq\("restaurant_id", restaurantId\)/);
  assert.match(hostedMethod, /\.limit\(limit\)/);
  assert.match(hostedMethod, /INVENTORY_COUNT_SESSION_HISTORY_LIMIT/);

  const demoMethod = demo.match(/async listInventoryCountSessions\([\s\S]*?\n    \},/)?.[0] ?? "";
  assert.match(demoMethod, /detail\.session\.restaurant_id === restaurantId/);
  assert.match(demoMethod, /\.slice\(0, limit\)/);
  assert.match(demoMethod, /INVENTORY_COUNT_SESSION_HISTORY_LIMIT/);

  assert.match(application, /listInventoryCountSessionHistory/);
  assert.match(application, /statuses:\s*\["approved", "cancelled"\]/);
});

test("inventory hub and routes expose count history screens", () => {
  const hub = readFileSync("app/(tabs)/inventory.tsx", "utf8");
  const layout = readFileSync("app/_layout.tsx", "utf8");
  const routeSmoke = readFileSync("scripts/mobile-route-smoke.mjs", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(hub, /\/inventory\/count-history/);
  assert.match(hub, /inventory\.count\.history\.cardAction/);
  assert.match(layout, /inventory\/count-history/);
  assert.match(layout, /inventory\/count-session\/\[id\]/);
  assert.match(routeSmoke, /\/inventory\/count-history/);
  assert.match(catalog, /"inventory\.count\.history\.title"/);
  assert.match(catalog, /"inventory\.count\.history\.emptyTitle"/);
});
