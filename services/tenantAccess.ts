import type { RestaurantMembership, RestaurantRole } from "../types/mise";
import {
  canApproveInventoryCountSession,
  canDraftInventoryCountSession
} from "./domain/inventoryCountSessions";
import { canRecordInventoryWaste as canRecordInventoryWasteRole } from "./domain/inventoryWaste";
import {
  canManageStorageLocations as canManageStorageLocationsRole,
  canTransferInventory as canTransferInventoryRole
} from "./domain/inventoryTransfer";
import { canViewMemberInvites } from "./domain/teamInvites";
import { canManageRestaurantTeam, canViewRestaurantTeam } from "./domain/teamMembership";

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

export function canExportRestaurantData(
  memberships: RestaurantMembership[],
  restaurantId: string | null | undefined
) {
  return canDeleteRestaurantData(memberships, restaurantId);
}

export function canUpdateRestaurantProfile(
  memberships: RestaurantMembership[],
  restaurantId: string | null | undefined
) {
  return canDeleteRestaurantData(memberships, restaurantId);
}

export function canViewTeamForRestaurant(
  memberships: RestaurantMembership[],
  restaurantId: string | null | undefined
) {
  const membership = activeMembershipForRestaurant(memberships, restaurantId);
  return Boolean(membership && canViewRestaurantTeam(membership.role));
}

export function canManageTeamForRestaurant(
  memberships: RestaurantMembership[],
  restaurantId: string | null | undefined
) {
  const membership = activeMembershipForRestaurant(memberships, restaurantId);
  return Boolean(membership && canManageRestaurantTeam(membership.role));
}

export function canViewMemberInvitesForRestaurant(
  memberships: RestaurantMembership[],
  restaurantId: string | null | undefined
) {
  const membership = activeMembershipForRestaurant(memberships, restaurantId);
  return Boolean(membership && canViewMemberInvites(membership.role));
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

export function canTransferInventory(
  memberships: RestaurantMembership[],
  restaurantId: string | null | undefined
) {
  const membership = activeMembershipForRestaurant(memberships, restaurantId);
  return canTransferInventoryRole(membership?.role);
}

export function canManageStorageLocations(
  memberships: RestaurantMembership[],
  restaurantId: string | null | undefined
) {
  const membership = activeMembershipForRestaurant(memberships, restaurantId);
  return canManageStorageLocationsRole(membership?.role);
}

export function requireRestaurantAccess(
  memberships: RestaurantMembership[],
  restaurantId: string | null | undefined
) {
  if (!canReadRestaurantData(memberships, restaurantId)) {
    throw new Error("You do not have access to this restaurant.");
  }
}
