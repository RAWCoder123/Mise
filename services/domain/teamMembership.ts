import type { RestaurantRole, RestaurantTeamMember } from "../../types/mise";

// Pure team-management rules mirroring the database membership RPCs
// (add/update/remove_restaurant_member + leave_my_restaurant_membership):
// owners manage every non-owner membership, admins manage managers and staff,
// nobody mutates owners from the client, and only non-owners may leave their
// own membership via the dedicated leave RPC.

export type AssignableTeamRole = Exclude<RestaurantRole, "owner">;

export type TeamMembershipErrorStatus =
  | "account_not_found"
  | "already_member"
  | "permission_denied"
  | "unknown";

export class TeamMembershipError extends Error {
  readonly status: TeamMembershipErrorStatus;

  constructor(status: TeamMembershipErrorStatus, message: string) {
    super(message);
    this.name = "TeamMembershipError";
    this.status = status;
  }
}

const roleRank: Record<RestaurantRole, number> = {
  owner: 0,
  admin: 1,
  manager: 2,
  staff: 3
};

/** Roles the actor may assign when adding or re-roling a member. */
export function assignableTeamRoles(actorRole: RestaurantRole | null | undefined): AssignableTeamRole[] {
  if (actorRole === "owner") return ["admin", "manager", "staff"];
  if (actorRole === "admin") return ["manager", "staff"];
  return [];
}

/** Whether the actor can add members or mutate any membership at all. */
export function canManageTeam(actorRole: RestaurantRole | null | undefined): boolean {
  return assignableTeamRoles(actorRole).length > 0;
}

/** Whether the actor can change or remove a specific member. */
export function canEditTeamMember(
  actorRole: RestaurantRole | null | undefined,
  target: { role: RestaurantRole; isSelf: boolean }
): boolean {
  if (!actorRole || target.isSelf || target.role === "owner") return false;
  if (actorRole === "owner") return true;
  if (actorRole === "admin") return target.role === "manager" || target.role === "staff";
  return false;
}

/**
 * Non-owners may leave their own active membership. Owners must transfer
 * ownership or use account deletion; client remove/leave never orphans a
 * restaurant by self-removing the last owner.
 */
export function canLeaveRestaurantMembership(
  actorRole: RestaurantRole | null | undefined
): boolean {
  return actorRole === "admin" || actorRole === "manager" || actorRole === "staff";
}

/** Normalized lowercase email, or null when the input is not a usable address. */
export function normalizeTeamMemberEmail(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

/** Stable display order: owners first, then admins, managers, staff, oldest first. */
export function sortTeamMembers(members: RestaurantTeamMember[]): RestaurantTeamMember[] {
  return [...members].sort((a, b) => {
    const rankDelta = (roleRank[a.role] ?? 9) - (roleRank[b.role] ?? 9);
    if (rankDelta !== 0) return rankDelta;
    return a.created_at.localeCompare(b.created_at);
  });
}

/** Maps Postgres/RPC failures onto operator-facing team membership statuses. */
export function teamMembershipErrorFrom(error: unknown): TeamMembershipError {
  if (error instanceof TeamMembershipError) return error;
  const code = error && typeof error === "object" ? (error as { code?: unknown }).code : null;
  const message =
    error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "Team membership change failed.";
  if (code === "23505") return new TeamMembershipError("already_member", message);
  if (code === "P0002") return new TeamMembershipError("account_not_found", message);
  if (code === "42501") return new TeamMembershipError("permission_denied", message);
  return new TeamMembershipError("unknown", message);
}
