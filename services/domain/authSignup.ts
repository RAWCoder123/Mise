import {
  isValidRecoveryEmail,
  normalizeRecoveryEmail,
  validateNewPassword
} from "./authRecovery";
import { buildInviteClaimPath } from "./teamInvites";

export const SIGNUP_PATH = "/signup";

export type SignUpOutcome =
  | { status: "signed_in" }
  | { status: "confirm_email"; email: string };

export function normalizeSignupEmail(email: string): string {
  return normalizeRecoveryEmail(email);
}

export function isValidSignupEmail(email: string): boolean {
  return isValidRecoveryEmail(email);
}

export function validateSignupPassword(password: string): string | null {
  return validateNewPassword(password);
}

/** Supabase returns an empty identities array when the email is already registered. */
export function isDuplicateAuthIdentity(
  user: { identities?: Array<unknown> | null } | null | undefined
): boolean {
  return Array.isArray(user?.identities) && user.identities.length === 0;
}

export function resolvePostAuthPath(options: {
  pendingInviteToken: string | null;
  hasRestaurant?: boolean;
}): string {
  if (options.pendingInviteToken) {
    return buildInviteClaimPath(options.pendingInviteToken);
  }
  if (options.hasRestaurant) return "/today";
  return "/";
}
