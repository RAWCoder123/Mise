import type { RestaurantMembershipStatus, RestaurantRole } from "../../types/mise";

export type AssignableRestaurantRole = Exclude<RestaurantRole, "owner">;

const ROLE_RANK: Record<RestaurantRole, number> = {
  owner: 0,
  admin: 1,
  manager: 2,
  staff: 3
};

export function normalizeMemberEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidMemberEmail(email: string): boolean {
  const normalized = normalizeMemberEmail(email);
  if (normalized.length < 3 || normalized.length > 254) return false;
  if (/[\u0000-\u001f\u007f]/.test(normalized)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function canViewRestaurantTeam(role: RestaurantRole | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "manager";
}

export function canManageRestaurantTeam(role: RestaurantRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function rolesAssignableBy(actorRole: RestaurantRole | null | undefined): AssignableRestaurantRole[] {
  if (actorRole === "owner") return ["admin", "manager", "staff"];
  if (actorRole === "admin") return ["manager", "staff"];
  return [];
}

export function canActorChangeMemberRole(
  actorRole: RestaurantRole | null | undefined,
  targetRole: RestaurantRole,
  nextRole: RestaurantRole
): boolean {
  if (!canManageRestaurantTeam(actorRole)) return false;
  if (targetRole === "owner") return false;
  if (actorRole === "owner") {
    return nextRole === "owner" || nextRole === "admin" || nextRole === "manager" || nextRole === "staff";
  }
  return (
    (targetRole === "manager" || targetRole === "staff") &&
    (nextRole === "manager" || nextRole === "staff")
  );
}

export function canActorChangeMemberStatus(
  actorRole: RestaurantRole | null | undefined,
  targetRole: RestaurantRole,
  nextStatus: RestaurantMembershipStatus
): boolean {
  if (nextStatus === "invited") return false;
  if (!canManageRestaurantTeam(actorRole)) return false;
  if (targetRole === "owner") return false;
  if (actorRole === "owner") return nextStatus === "active" || nextStatus === "disabled";
  return targetRole === "manager" || targetRole === "staff";
}

export function canActorRemoveMember(
  actorRole: RestaurantRole | null | undefined,
  targetRole: RestaurantRole
): boolean {
  if (!canManageRestaurantTeam(actorRole)) return false;
  if (targetRole === "owner") return false;
  if (actorRole === "owner") return true;
  return targetRole === "manager" || targetRole === "staff";
}

export function compareTeamMembers<T extends { role: RestaurantRole; status: RestaurantMembershipStatus; email: string }>(
  left: T,
  right: T
): number {
  const roleDelta = ROLE_RANK[left.role] - ROLE_RANK[right.role];
  if (roleDelta !== 0) return roleDelta;
  const statusRank = (status: RestaurantMembershipStatus) =>
    status === "active" ? 0 : status === "invited" ? 1 : 2;
  const statusDelta = statusRank(left.status) - statusRank(right.status);
  if (statusDelta !== 0) return statusDelta;
  return left.email.localeCompare(right.email);
}
