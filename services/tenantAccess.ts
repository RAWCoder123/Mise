import type { RestaurantMembership, RestaurantRole } from "../types/mise";
import {
  canApproveInventoryCountSession,
  canDraftInventoryCountSession
} from "./domain/inventoryCountSessions";
import { canRecordInventoryWaste as canRecordInventoryWasteRole } from "./domain/inventoryWaste";

const managerRoles: RestaurantRole[] = ["owner", "admin", "manager"];
const ownerAdminRoles: RestaurantRole[] = ["owner", "admin"];

export function activeMembershipForRestaurant(
  memberships: RestaurantMembership[],
  restaurantId: string | null | undefined
) {
  if (!restaurantId) return null;
  return (
    memberships.find(
      (membership) => membership.restaurant_id === restaurantId && membership.status === "active"
    ) ?? null
  );
}

export function canReadRestaurantData(
  memberships: RestaurantMembership[],
  restaurantId: string | null | undefined
) {
  return Boolean(activeMembershipForRestaurant(memberships, restaurantId));
}

export function canManageRestaurantData(
  memberships: RestaurantMembership[],
  restaurantId: string | null | undefined
) {
  const membership = activeMembershipForRestaurant(memberships, restaurantId);
  return Boolean(membership && managerRoles.includes(membership.role));
}

export function canDeleteRestaurantData(
  memberships: RestaurantMembership[],
  restaurantId: string | null | undefined
) {
  const membership = activeMembershipForRestaurant(memberships, restaurantId);
  return Boolean(membership && ownerAdminRoles.includes(membership.role));
}

export function canUpdateRestaurantProfile(
  memberships: RestaurantMembership[],
  restaurantId: string | null | undefined
) {
  return canDeleteRestaurantData(memberships, restaurantId);
}

export function canDraftInventoryCount(
  memberships: RestaurantMembership[],
  restaurantId: string | null | undefined
) {
  const membership = activeMembershipForRestaurant(memberships, restaurantId);
  return canDraftInventoryCountSession(membership?.role);
}

export function canApproveInventoryCount(
  memberships: RestaurantMembership[],
  restaurantId: string | null | undefined
) {
  const membership = activeMembershipForRestaurant(memberships, restaurantId);
  return canApproveInventoryCountSession(membership?.role);
}

export function canRecordInventoryWaste(
  memberships: RestaurantMembership[],
  restaurantId: string | null | undefined
) {
  const membership = activeMembershipForRestaurant(memberships, restaurantId);
  return canRecordInventoryWasteRole(membership?.role);
}

export function requireRestaurantAccess(
  memberships: RestaurantMembership[],
  restaurantId: string | null | undefined
) {
  if (!canReadRestaurantData(memberships, restaurantId)) {
    throw new Error("You do not have access to this restaurant.");
  }
}
