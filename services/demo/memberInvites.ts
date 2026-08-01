import type {
  CreatedRestaurantMemberInvite,
  RestaurantMemberInvite,
  RestaurantMembership
} from "../../types/mise";
import { createId } from "../domain/miseDomain";
import {
  canActorCreateMemberInvite,
  canActorRevokeMemberInvite,
  canViewMemberInvites,
  effectiveInviteStatus,
  generateInviteToken,
  hashInviteToken,
  isInvitePending,
  isValidInviteEmail,
  isValidInviteToken,
  normalizeInviteEmail,
  normalizeInviteToken,
  resolveInviteExpiryHours
} from "../domain/teamInvites";
import type { AssignableRestaurantRole } from "../domain/teamMembership";
import { normalizeRestaurantMembership } from "../miseValidation";
import type { DemoMemberInviteRecord, DemoState } from "./replaceableDemoData";

function ensureDemoMemberships(state: DemoState) {
  if (!Array.isArray(state.memberships)) {
    state.memberships = [];
  }
}

function ensureDemoMemberInvites(state: DemoState) {
  if (!Array.isArray(state.memberInvites)) {
    state.memberInvites = [];
  }
}

function ensureDemoAuditLogs(state: DemoState) {
  if (!Array.isArray(state.auditLogs)) {
    state.auditLogs = [];
  }
}

function actorDemoMembership(state: DemoState, restaurantId: string, actorUserId: string) {
  ensureDemoMemberships(state);
  return (
    state.memberships.find(
      (membership) =>
        membership.restaurant_id === restaurantId &&
        membership.user_id === actorUserId &&
        membership.status === "active"
    ) ?? null
  );
}

function appendInviteAuditLog(
  state: DemoState,
  input: {
    restaurant_id: string;
    actor_user_id?: string;
    action: string;
    entity_table: string;
    entity_id: string;
    metadata?: Record<string, unknown>;
  }
) {
  ensureDemoAuditLogs(state);
  state.auditLogs.unshift({
    id: createId("audit"),
    restaurant_id: input.restaurant_id,
    actor_user_id: input.actor_user_id ?? null,
    action: input.action,
    entity_table: input.entity_table,
    entity_id: input.entity_id,
    metadata: input.metadata ?? {},
    created_at: new Date().toISOString()
  });
}

function toPublicMemberInvite(
  invite: DemoMemberInviteRecord,
  now = new Date()
): RestaurantMemberInvite {
  return {
    id: invite.id,
    restaurant_id: invite.restaurant_id,
    email: invite.email,
    role: invite.role,
    // Read-only: do not persist expiry here; claim/revoke write paths mutate.
    status: effectiveInviteStatus(invite.status, invite.expires_at, now),
    expires_at: invite.expires_at,
    created_at: invite.created_at,
    claimed_at: invite.claimed_at,
    revoked_at: invite.revoked_at
  };
}

export async function createDemoMemberInvite(
  state: DemoState,
  restaurantId: string,
  email: string,
  role: AssignableRestaurantRole,
  actorUserId: string,
  expiresInHours?: number
): Promise<CreatedRestaurantMemberInvite> {
  ensureDemoMemberships(state);
  ensureDemoMemberInvites(state);
  const actor = actorDemoMembership(state, restaurantId, actorUserId);
  if (!actor || !canActorCreateMemberInvite(actor.role, role)) {
    throw new Error("Membership access denied.");
  }
  const normalizedEmail = normalizeInviteEmail(email);
  if (!isValidInviteEmail(normalizedEmail)) {
    throw new Error("Enter a valid teammate email address.");
  }
  const expiryHours = resolveInviteExpiryHours(expiresInHours);
  const existingMember = state.memberships.find((membership) => {
    if (membership.restaurant_id !== restaurantId) return false;
    const user = state.users.find((entry) => entry.id === membership.user_id);
    return user ? normalizeInviteEmail(user.email) === normalizedEmail : false;
  });
  if (existingMember) {
    throw new Error("Membership already exists.");
  }

  const now = new Date();
  for (const invite of state.memberInvites) {
    if (
      invite.restaurant_id === restaurantId &&
      invite.email === normalizedEmail &&
      invite.status === "pending"
    ) {
      invite.status = "revoked";
      invite.revoked_at = now.toISOString();
    }
  }

  const claimToken = generateInviteToken();
  const tokenHash = await hashInviteToken(claimToken);
  const created: DemoMemberInviteRecord = {
    id: createId("invite"),
    restaurant_id: restaurantId,
    email: normalizedEmail,
    role,
    status: "pending",
    token_hash: tokenHash,
    created_by: actorUserId,
    claimed_by: null,
    expires_at: new Date(now.getTime() + expiryHours * 60 * 60 * 1000).toISOString(),
    created_at: now.toISOString(),
    claimed_at: null,
    revoked_at: null
  };
  state.memberInvites.unshift(created);
  appendInviteAuditLog(state, {
    restaurant_id: restaurantId,
    actor_user_id: actorUserId,
    action: "restaurant_member_invite_created",
    entity_table: "restaurant_member_invites",
    entity_id: created.id,
    metadata: {
      email: normalizedEmail,
      role,
      expires_at: created.expires_at
    }
  });
  return {
    ...toPublicMemberInvite(created),
    claim_token: claimToken
  };
}

export function listDemoMemberInvites(
  state: DemoState,
  restaurantId: string,
  actorUserId: string
): RestaurantMemberInvite[] {
  ensureDemoMemberships(state);
  ensureDemoMemberInvites(state);
  const actor = actorDemoMembership(state, restaurantId, actorUserId);
  if (!actor || !canViewMemberInvites(actor.role)) {
    throw new Error("Membership access denied.");
  }
  const now = new Date();
  return state.memberInvites
    .filter((invite) => invite.restaurant_id === restaurantId)
    .slice(0, 100)
    .map((invite) => toPublicMemberInvite(invite, now));
}

export function revokeDemoMemberInvite(
  state: DemoState,
  restaurantId: string,
  inviteId: string,
  actorUserId: string
): RestaurantMemberInvite {
  ensureDemoMemberships(state);
  ensureDemoMemberInvites(state);
  const actor = actorDemoMembership(state, restaurantId, actorUserId);
  if (!actor) throw new Error("Membership access denied.");
  const invite = state.memberInvites.find(
    (entry) => entry.id === inviteId && entry.restaurant_id === restaurantId
  );
  if (!invite) throw new Error("Invite is unavailable.");
  if (invite.status !== "pending") throw new Error("Only pending invites can be revoked.");
  if (!canActorRevokeMemberInvite(actor.role, invite.role)) {
    throw new Error("Membership access denied.");
  }
  invite.status = "revoked";
  invite.revoked_at = new Date().toISOString();
  appendInviteAuditLog(state, {
    restaurant_id: restaurantId,
    actor_user_id: actorUserId,
    action: "restaurant_member_invite_revoked",
    entity_table: "restaurant_member_invites",
    entity_id: invite.id,
    metadata: { email: invite.email, role: invite.role }
  });
  return toPublicMemberInvite(invite);
}

export async function claimDemoMemberInvite(
  state: DemoState,
  claimToken: string,
  actorUserId: string
): Promise<RestaurantMembership> {
  ensureDemoMemberships(state);
  ensureDemoMemberInvites(state);
  const normalizedToken = normalizeInviteToken(claimToken);
  if (!isValidInviteToken(normalizedToken)) {
    throw new Error("Invite token is invalid.");
  }
  const tokenHash = await hashInviteToken(normalizedToken);
  const invite = state.memberInvites.find((entry) => entry.token_hash === tokenHash);
  if (!invite) throw new Error("Invite is unavailable.");
  if (invite.status === "revoked") throw new Error("Invite has been revoked.");
  if (invite.status === "claimed") throw new Error("Invite has already been claimed.");
  if (invite.status === "expired" || !isInvitePending(invite.status, invite.expires_at)) {
    invite.status = "expired";
    throw new Error("Invite has expired.");
  }

  const actor = state.users.find((entry) => entry.id === actorUserId);
  if (!actor) {
    throw new Error("Membership target is unavailable.");
  }
  if (normalizeInviteEmail(actor.email) !== invite.email) {
    throw new Error("Invite email does not match the signed-in account.");
  }
  if (
    state.memberships.some(
      (membership) => membership.restaurant_id === invite.restaurant_id && membership.user_id === actorUserId
    )
  ) {
    throw new Error("Membership already exists.");
  }

  const now = new Date().toISOString();
  actor.email = invite.email;
  actor.restaurant_id = invite.restaurant_id;
  actor.role = invite.role;
  const created = normalizeRestaurantMembership({
    id: createId("membership"),
    restaurant_id: invite.restaurant_id,
    user_id: actorUserId,
    role: invite.role,
    status: "active",
    created_at: now,
    updated_at: now
  });
  state.memberships.push(created);
  invite.status = "claimed";
  invite.claimed_by = actorUserId;
  invite.claimed_at = now;
  appendInviteAuditLog(state, {
    restaurant_id: invite.restaurant_id,
    actor_user_id: actorUserId,
    action: "restaurant_member_invite_claimed",
    entity_table: "restaurant_member_invites",
    entity_id: invite.id,
    metadata: {
      membership_id: created.id,
      role: created.role,
      email: invite.email
    }
  });
  appendInviteAuditLog(state, {
    restaurant_id: invite.restaurant_id,
    actor_user_id: actorUserId,
    action: "restaurant_member_added",
    entity_table: "restaurant_memberships",
    entity_id: created.id,
    metadata: {
      target_user_id: actorUserId,
      role: created.role,
      status: "active",
      source: "invite_claim"
    }
  });
  return created;
}
