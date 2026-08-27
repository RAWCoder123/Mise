import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { canRecordInventoryWaste } from "../services/domain/inventoryWaste";
import { canRecordInventoryWaste as canRecordInventoryWasteForRestaurant } from "../services/tenantAccess";
import type { RestaurantMembership } from "../types/mise";

function membership(
  restaurantId: string,
  role: RestaurantMembership["role"],
  status: RestaurantMembership["status"] = "active"
): RestaurantMembership {
  return {
    id: `${restaurantId}_${role}`,
    restaurant_id: restaurantId,
    user_id: "user_a",
    role,
    status,
    created_at: "2026-08-27T00:00:00.000Z",
    updated_at: "2026-08-27T00:00:00.000Z"
  };
}

test("staff may record waste while remaining outside manager inventory edit roles", () => {
  assert.equal(canRecordInventoryWaste("staff"), true);
  assert.equal(canRecordInventoryWaste("manager"), true);
  assert.equal(canRecordInventoryWaste("owner"), true);
  assert.equal(canRecordInventoryWaste("admin"), true);
  assert.equal(canRecordInventoryWaste(null), false);

  const staffMembership = [membership("restaurant_a", "staff")];
  assert.equal(canRecordInventoryWasteForRestaurant(staffMembership, "restaurant_a"), true);
  assert.equal(canRecordInventoryWasteForRestaurant(staffMembership, "restaurant_b"), false);
  assert.equal(
    canRecordInventoryWasteForRestaurant([membership("restaurant_a", "staff", "disabled")], "restaurant_a"),
    false
  );
});

test("inventory detail and list surface staff waste without unlocking manager ops", () => {
  const detail = readFileSync("app/inventory/[id].tsx", "utf8");
  const list = readFileSync("app/(tabs)/inventory.tsx", "utf8");
  const migration = readFileSync(
    "supabase/migrations/20260827210000_staff_inventory_waste_roles.sql",
    "utf8"
  );

  assert.match(detail, /canRecordInventoryWaste/);
  assert.match(detail, /canRecordWaste/);
  assert.match(detail, /staffWasteOnly/);
  assert.match(detail, /wasteMutationAllowed/);
  assert.match(detail, /inventory\.detail\.limitedAccess/);
  assert.match(detail, /inventory\.ops\.wasteTitle/);
  assert.match(detail, /inventory\.ops\.submitWaste/);
  assert.doesNotMatch(detail, /mutationAllowed = canManage && hubReady[\s\S]*wasteMutationAllowed = canManage/);

  assert.match(list, /canRecordInventoryWaste/);
  assert.match(list, /showStaffWasteTip/);
  assert.match(list, /inventory\.waste\.cardTitle/);
  assert.match(list, /inventory\.waste\.findItemAction/);

  assert.match(
    migration,
    /p_event_type = 'waste'[\s\S]*array\['owner', 'admin', 'manager', 'staff'\]/i
  );
  assert.match(
    migration,
    /elsif not private\.has_restaurant_role\([\s\S]*array\['owner', 'admin', 'manager'\]/i
  );
  assert.match(migration, /Staff or manager access required/i);
  assert.match(migration, /grant execute on function public\.record_inventory_event/i);
});
