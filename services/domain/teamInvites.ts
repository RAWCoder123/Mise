import type { AssignableRestaurantRole } from "./teamMembership";
import { isValidMemberEmail, normalizeMemberEmail, rolesAssignableBy } from "./teamMembership";
import type { RestaurantRole } from "../../types/mise";

export type RestaurantMemberInviteStatus = "pending" | "claimed" | "revoked" | "expired";

export const DEFAULT_INVITE_EXPIRY_HOURS = 168;
export const MAX_INVITE_EXPIRY_HOURS = 720;
export const INVITE_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export function normalizeInviteToken(token: string): string {
  return token.trim().toLowerCase();
}

export function isValidInviteToken(token: string): boolean {
  return INVITE_TOKEN_PATTERN.test(normalizeInviteToken(token));
}

export function canActorCreateMemberInvite(
  actorRole: RestaurantRole | null | undefined,
  inviteRole: AssignableRestaurantRole
): boolean {
  return rolesAssignableBy(actorRole).includes(inviteRole);
}

export function canActorRevokeMemberInvite(
  actorRole: RestaurantRole | null | undefined,
  inviteRole: AssignableRestaurantRole
): boolean {
  if (actorRole === "owner") return true;
  if (actorRole === "admin") return inviteRole === "manager" || inviteRole === "staff";
  return false;
}

export function canViewMemberInvites(role: RestaurantRole | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "manager";
}

export function normalizeInviteEmail(email: string): string {
  return normalizeMemberEmail(email);
}

export function isValidInviteEmail(email: string): boolean {
  return isValidMemberEmail(email);
}

export function resolveInviteExpiryHours(hours?: number | null): number {
  if (hours == null || !Number.isFinite(hours)) return DEFAULT_INVITE_EXPIRY_HOURS;
  const rounded = Math.floor(hours);
  if (rounded < 1 || rounded > MAX_INVITE_EXPIRY_HOURS) {
    throw new Error("Invite expiry is invalid.");
  }
  return rounded;
}

export function generateInviteToken(randomBytes: Uint8Array = defaultRandomBytes(32)): string {
  if (randomBytes.byteLength < 32) {
    throw new Error("Invite token entropy must be at least 32 bytes.");
  }
  return [...randomBytes.subarray(0, 32)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashInviteToken(token: string): Promise<string> {
  const normalized = normalizeInviteToken(token);
  if (!isValidInviteToken(normalized)) {
    throw new Error("Invite token is invalid.");
  }
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = new Uint8Array(await subtle.digest("SHA-256", new TextEncoder().encode(normalized)));
    return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(normalized).digest("hex");
}

export function buildInviteClaimPath(token: string): string {
  const normalized = normalizeInviteToken(token);
  if (!isValidInviteToken(normalized)) {
    throw new Error("Invite token is invalid.");
  }
  return `/invite/${normalized}`;
}

export function isInvitePending(status: RestaurantMemberInviteStatus, expiresAt: string, now = new Date()): boolean {
  if (status !== "pending") return false;
  const expiresMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresMs)) return false;
  return expiresMs > now.getTime();
}

function defaultRandomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure random generator is unavailable.");
  }
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}
