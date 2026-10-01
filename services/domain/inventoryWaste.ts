import type { RestaurantRole } from "../../types/mise";

/** Staff may record observed spoilage immediately; count/par edits stay manager+. */
export const INVENTORY_WASTE_RECORD_ROLES: readonly RestaurantRole[] = [
  "owner",
  "admin",
  "manager",
  "staff"
];

export function canRecordInventoryWaste(role: RestaurantRole | null | undefined): boolean {
  return Boolean(role && INVENTORY_WASTE_RECORD_ROLES.includes(role));
}
