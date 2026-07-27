import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  RESTAURANT_EXPORT_DATASETS,
  normalizeRestaurantDataExport
} from "../services/repositories/repositoryContracts";

const restaurantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function validPayload() {
  const datasets = Object.fromEntries(
    RESTAURANT_EXPORT_DATASETS.map((name) => [name, []])
  ) as Record<string, unknown[]>;
  datasets.inventory_items = [{
    id: "item-a",
    restaurant_id: restaurantId,
    item_name: "Chicken Breast"
  }];
  const counts = Object.fromEntries([
    ["team", 1],
    ...RESTAURANT_EXPORT_DATASETS.map((name) => [name, datasets[name]!.length])
  ]);

  return {
    schemaVersion: 1,
    generatedAt: "2026-07-27T12:00:00.000Z",
    restaurantId,
    restaurant: {
      id: restaurantId,
      name: "Luna Bistro",
      address: null,
      cuisine_type: "Cafe",
      brand_color: "#EF3F27",
      accent_color: "#EF3F27",
      logo_url: null,
      service_style: "cafe",
      timezone: "America/New_York",
      currency: "USD",
      operational_profile: {
        serviceStyle: "cafe",
        orderCadence: [],
        prepWindows: [],
        primarySuppliers: [],
        inventoryReviewDays: [],
        notes: null
      },
      created_at: "2026-07-01T12:00:00.000Z"
    },
    team: [{
      restaurant_id: restaurantId,
      user_id: "owner-a",
      role: "owner",
      status: "active",
      name: "Owner",
      email: "owner@example.test",
      created_at: "2026-07-01T12:00:00.000Z",
      updated_at: "2026-07-01T12:00:00.000Z"
    }],
    datasets,
    counts,
    retention: {
      scope: "restaurant_operational_data",
      credentialsExcluded: true,
      privateSecurityLogsExcluded: true,
      backupDeletion: "Backups expire on the provider schedule."
    }
  };
}

test("client normalizes a complete tenant-scoped export", () => {
  const result = normalizeRestaurantDataExport(validPayload(), restaurantId);

  assert.equal(result.restaurant.id, restaurantId);
  assert.equal(result.team.length, 1);
  assert.equal(result.datasets.inventory_items.length, 1);
  assert.equal(result.counts.inventory_items, 1);
  assert.deepEqual(Object.keys(result.datasets).sort(), [...RESTAURANT_EXPORT_DATASETS].sort());
});

test("client rejects cross-tenant, incomplete, and protected export payloads", () => {
  const crossTenant = validPayload();
  crossTenant.datasets.inventory_items![0] = {
    id: "item-b",
    restaurant_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  };
  assert.throws(
    () => normalizeRestaurantDataExport(crossTenant, restaurantId),
    /restaurant scope validation/
  );

  const incomplete = validPayload();
  delete incomplete.datasets.inventory_events;
  assert.throws(
    () => normalizeRestaurantDataExport(incomplete, restaurantId),
    /incomplete inventory_events dataset/
  );

  const protectedPayload = validPayload();
  protectedPayload.datasets.pos_integrations!.push({
    restaurant_id: restaurantId,
    access_token: "must-never-leave-the-provider-boundary"
  });
  protectedPayload.counts.pos_integrations = 1;
  assert.throws(
    () => normalizeRestaurantDataExport(protectedPayload, restaurantId),
    /protected provider data/
  );
});

test("hosted and demo exports stay behind one stable screen-facing facade", () => {
  const application = readFileSync("services/application/restaurant.ts", "utf8");
  const facade = readFileSync("services/miseService.ts", "utf8");
  const hosted = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
  const demo = readFileSync("services/repositories/demoRepository.ts", "utf8");

  assert.match(application, /export async function exportRestaurantData/);
  assert.match(application, /repository\.exportRestaurantData\(normalizedRestaurantId\)/);
  assert.match(facade, /export \* from "\.\/application\/restaurant"/);
  assert.match(hosted, /functions\.invoke\("export-restaurant-data"/);
  assert.match(hosted, /normalizeRestaurantDataExport\(data, restaurantId\)/);
  assert.match(demo, /buildDemoRestaurantExport/);
  assert.doesNotMatch(demo, /functions\.invoke\("export-restaurant-data"/);
});
