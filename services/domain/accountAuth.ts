// Pure sign-up decision logic for the Mise account flows. Keeping the
// Supabase response interpretation here lets the session context stay thin
// and makes the confirmation/already-registered branches unit-testable.

/** Supabase's default minimum password length. */
export const MIN_ACCOUNT_PASSWORD_LENGTH = 6;
export const MAX_ACCOUNT_EMAIL_LENGTH = 254;
export const MIN_INVITE_PASSWORD_LENGTH = 12;
export const MAX_INVITE_PASSWORD_LENGTH = 128;
const MAX_INVITE_CALLBACK_LENGTH = 20_000;
const MAX_INVITE_TOKEN_LENGTH = 12_000;

export type SignUpValidationError =
  | "email_required"
  | "email_invalid"
  | "password_too_short"
  | "password_mismatch";

export type SignUpOutcome = "session_ready" | "confirmation_required" | "already_registered";

export type InviteCallbackError =
  | "invite_callback_required"
  | "invite_callback_invalid"
  | "invite_callback_wrong_destination"
  | "invite_callback_wrong_type"
  | "invite_callback_incomplete"
  | "invite_callback_mixed_credentials"
  | "invite_callback_rejected";

export type InvitePasswordValidationError =
  | "password_too_short"
  | "password_too_long"
  | "password_mismatch";

export interface InviteCallbackTokens {
  accessToken: string;
  refreshToken: string;
}

export function isValidAccountEmail(value: string) {
  const normalized = value.trim();
  return (
    normalized.length >= 3 &&
    normalized.length <= MAX_ACCOUNT_EMAIL_LENGTH &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  );
}

/**
 * Parse the exact custom-scheme callback issued for an owner invitation.
 *
 * Supabase returns the invite session in the URL fragment. Query credentials
 * are accepted only as a complete alternate representation for SDK/runtime
 * compatibility; credentials from the two locations are never combined.
 */
export function parseInviteCallbackUrl(value: string): InviteCallbackTokens | InviteCallbackError {
  if (!value) return "invite_callback_required";
  if (value.length > MAX_INVITE_CALLBACK_LENGTH) return "invite_callback_invalid";

  let callback: URL;
  try {
    callback = new URL(value);
  } catch {
    return "invite_callback_invalid";
  }

  const destination = `${callback.hostname}${callback.pathname}`.replace(/^\/+|\/+$/g, "");
  if (callback.protocol !== "mise:" || destination !== "accept-invite") {
    return "invite_callback_wrong_destination";
  }

  const fragment = new URLSearchParams(callback.hash.replace(/^#/, ""));
  const query = callback.searchParams;
  const credentialKeys = ["access_token", "refresh_token", "type", "error", "error_code"];
  const fragmentHasCredentials = credentialKeys.some((key) => fragment.has(key));
  const queryHasCredentials = credentialKeys.some((key) => query.has(key));
  if (fragmentHasCredentials && queryHasCredentials) return "invite_callback_mixed_credentials";

  const source = fragmentHasCredentials ? fragment : query;
  if (source.has("error") || source.has("error_code")) return "invite_callback_rejected";
  if (source.get("type") !== "invite") return "invite_callback_wrong_type";

  const accessToken = source.get("access_token") ?? "";
  const refreshToken = source.get("refresh_token") ?? "";
  if (
    !accessToken ||
    !refreshToken ||
    accessToken.length > MAX_INVITE_TOKEN_LENGTH ||
    refreshToken.length > MAX_INVITE_TOKEN_LENGTH
  ) {
    return "invite_callback_incomplete";
  }

  return { accessToken, refreshToken };
}

export function validateInvitePassword(
  password: string,
  confirmPassword: string
): InvitePasswordValidationError | null {
  if (password.length < MIN_INVITE_PASSWORD_LENGTH) return "password_too_short";
  if (password.length > MAX_INVITE_PASSWORD_LENGTH) return "password_too_long";
  if (password !== confirmPassword) return "password_mismatch";
  return null;
}

export function validateSignUpInput(
  email: string,
  password: string,
  confirmPassword: string
): SignUpValidationError | null {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) return "email_required";
  if (!isValidAccountEmail(normalizedEmail)) return "email_invalid";
  if (password.length < MIN_ACCOUNT_PASSWORD_LENGTH) return "password_too_short";
  if (password !== confirmPassword) return "password_mismatch";
  return null;
}

interface SignUpResultShape {
  user: { identities?: unknown[] | null } | null;
  session: unknown | null;
}

/**
 * Interpret a successful `supabase.auth.signUp` response.
 *
 * - A session means email confirmation is disabled and the user is signed in.
 * - A user without a session means Supabase sent a confirmation email.
 * - A user with an empty `identities` array is Supabase's anti-enumeration
 *   response for an email that is already registered.
 */
export function interpretSignUpResult(result: SignUpResultShape): SignUpOutcome {
  if (result.user && Array.isArray(result.user.identities) && result.user.identities.length === 0) {
    return "already_registered";
  }
  if (result.session) return "session_ready";
  return "confirmation_required";
}

/** Matches Supabase auth errors raised when the email already has an account. */
export function isUserAlreadyRegisteredError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  if (code === "user_already_exists" || code === "email_exists") return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && /already (been )?registered|already exists/i.test(message);
}
